import type { User, PetSkin, Mission } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateReward, capAffinity } from "@/lib/reward"
import { getTodayKey, getToday } from "./reset"

export type MissionCompletionResult = {
  newlyCompleted: boolean
  missionId: string
  reward: {
    seeds: number
    starShards: number
    affinity: number
  }
}

type ActorWithSkin = User & { activePetSkin: PetSkin | null }

// Mission은 prisma/seed로만 채워지는 정적 표(17행)다. 유저 요청마다 다시 읽을 이유가 없어
// 프로세스 메모리에 한 번만 담는다. RDS 왕복이 약 200~390ms라 이 한 번이 체감에 그대로 남는다.
// 시드가 갱신되면 서버를 다시 띄워야 반영된다 — 미션 문구·보상 변경은 배포 단위 작업이라
// 그 제약을 받아들이는 쪽이 매 요청 왕복을 내는 것보다 낫다.
let missionCache: { byId: Map<string, Mission>; byCode: Map<string, Mission>; dailyCount: number } | null = null

async function getMissionCache() {
  if (!missionCache) {
    const missions = await prisma.mission.findMany()
    missionCache = {
      byId: new Map(missions.map((m) => [m.id, m])),
      byCode: new Map(missions.map((m) => [m.code, m])),
      dailyCount: missions.filter((m) => m.scope === "DAILY").length,
    }
  }
  return missionCache
}

/**
 * 일반 미션 완료 공통 함수.
 * P2002는 중복으로 보고 idempotent 결과 반환.
 */
export async function completeMission(params: {
  actor: ActorWithSkin
  missionId: string
  resetKey: string
  photoKey?: string
  /** 이미 조회해 둔 Mission. 있으면 재조회하지 않는다 */
  mission?: Mission
}): Promise<MissionCompletionResult> {
  const { actor, missionId, resetKey, photoKey } = params

  const mission = params.mission ?? (await getMissionCache()).byId.get(missionId)
  if (!mission) {
    throw new Error("미션을 찾을 수 없습니다")
  }

  // 트랜잭션 안에서 캐시를 채우면 첫 요청의 트랜잭션이 그만큼 길어진다. 미리 읽어 둔다
  const dailyMissionTotal = mission.scope === "DAILY" ? (await getMissionCache()).dailyCount : 0

  try {
    await prisma.$transaction(async (tx) => {
      // 완료 기록 생성
      await tx.userMission.create({
        data: {
          userId: actor.id,
          missionId,
          resetKey,
          photoKey: photoKey ?? null,
        },
      })

      // 보상 계산
      const baseReward = {
        seeds: mission.rewardSeeds,
        starShards: mission.rewardShards,
        affinity: mission.rewardAffinity,
      }

      const effectiveReward = calculateReward(actor.activePetSkin, baseReward)

      // 친밀도 상한 적용
      let affinityToGive = effectiveReward.affinity || 0
      if (affinityToGive > 0) {
        const todayDate = getToday()
        const needsReset = !actor.affinityTodayDate || actor.affinityTodayDate < todayDate

        if (needsReset) {
          await tx.user.update({
            where: { id: actor.id },
            data: { affinityToday: 0, affinityTodayDate: todayDate },
          })
          actor.affinityToday = 0
          actor.affinityTodayDate = todayDate
        }

        affinityToGive = capAffinity(actor.affinityToday, affinityToGive)
      }

      // 실제 지급
      await tx.user.update({
        where: { id: actor.id },
        data: {
          seeds: { increment: effectiveReward.seeds || 0 },
          starShards: { increment: effectiveReward.starShards || 0 },
          affinity: { increment: affinityToGive },
          affinityToday: { increment: affinityToGive },
        },
      })

      // streak 갱신 (일일 목표 달성 체크)
      if (mission.scope === "DAILY") {
        const today = getTodayKey()
        const dailyCount = await tx.userMission.count({
          where: {
            userId: actor.id,
            resetKey: today,
            mission: { scope: "DAILY" },
          },
        })

        // 일일 미션 개수는 시드 고정값이라 트랜잭션 안에서 세지 않는다(위 캐시에서 읽는다)
        const dailyTotal = dailyMissionTotal

        if (dailyCount >= dailyTotal) {
          // 오늘 전부 완료
          const todayDate = getToday()
          const yesterday = new Date(todayDate)
          yesterday.setDate(yesterday.getDate() - 1)

          const lastStreak = actor.lastStreakDate
          let newStreak = 1

          if (lastStreak && lastStreak >= yesterday) {
            if (lastStreak < todayDate) {
              // 어제 완료 → +1
              newStreak = actor.streakCount + 1
            } else {
              // 오늘 이미 갱신됨 → 유지
              newStreak = actor.streakCount
            }
          }

          // 일일 전체 완료: streak 갱신 + 별조각 60 보너스
          // calculateReward()를 경유해야 한다(CLAUDE.md 2절) — 스킨 고유 효과(별조각 +n%)가
          // 이 보너스에도 적용되게 하려면 직접 increment하면 안 된다.
          const dailyBonus = calculateReward(actor.activePetSkin, { starShards: 60 })
          await tx.user.update({
            where: { id: actor.id },
            data: {
              streakCount: newStreak,
              lastStreakDate: todayDate,
              starShards: { increment: dailyBonus.starShards || 0 },
            },
          })
        }
      }
    })

    return {
      newlyCompleted: true,
      missionId,
      reward: {
        seeds: mission.rewardSeeds,
        starShards: mission.rewardShards,
        affinity: mission.rewardAffinity,
      },
    }
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      // 중복 완료 → 추가 보상 0
      return {
        newlyCompleted: false,
        missionId,
        reward: { seeds: 0, starShards: 0, affinity: 0 },
      }
    }
    throw err
  }
}

/**
 * D 담당이 호출하는 내부 함수.
 * DAILY_COMMUNITY_POST, DAILY_CHAT 자동 완료.
 */
export async function completeMissionByCode(params: {
  actor: ActorWithSkin
  code: "DAILY_COMMUNITY_POST" | "DAILY_CHAT"
}): Promise<MissionCompletionResult> {
  const { actor, code } = params

  const mission = (await getMissionCache()).byCode.get(code)
  if (!mission) {
    throw new Error(`미션을 찾을 수 없습니다: ${code}`)
  }

  const today = getTodayKey()

  // 이미 완료한 미션이면 트랜잭션을 열지 않는다. 챗봇·글쓰기는 하루에 여러 번 호출되고
  // 두 번째부터는 전부 P2002로 롤백됐다 — 실패하는 트랜잭션이 왕복 약 830ms를 먹었다.
  // 유니크 조회 1회(약 200ms)로 갈아탄다. 경합 시에도 아래 completeMission이 P2002를
  // 잡으므로 이 선판정이 틀려도 결과는 같다.
  const already = await prisma.userMission.findUnique({
    where: { userId_missionId_resetKey: { userId: actor.id, missionId: mission.id, resetKey: today } },
    select: { id: true },
  })
  if (already) {
    return { newlyCompleted: false, missionId: mission.id, reward: { seeds: 0, starShards: 0, affinity: 0 } }
  }

  return completeMission({
    actor,
    missionId: mission.id,
    resetKey: today,
    mission,
  })
}
