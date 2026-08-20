import type { User, PetSkin } from "@prisma/client"
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

/**
 * 일반 미션 완료 공통 함수.
 * P2002는 중복으로 보고 idempotent 결과 반환.
 */
export async function completeMission(params: {
  actor: ActorWithSkin
  missionId: string
  resetKey: string
  photoKey?: string
}): Promise<MissionCompletionResult> {
  const { actor, missionId, resetKey, photoKey } = params

  const mission = await prisma.mission.findUnique({ where: { id: missionId } })
  if (!mission) {
    throw new Error("미션을 찾을 수 없습니다")
  }

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
          exp: { increment: effectiveReward.seeds || 0 },
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

        const dailyTotal = await tx.mission.count({ where: { scope: "DAILY" } })

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
          await tx.user.update({
            where: { id: actor.id },
            data: {
              streakCount: newStreak,
              lastStreakDate: todayDate,
              starShards: { increment: 60 },
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

  const mission = await prisma.mission.findUnique({ where: { code } })
  if (!mission) {
    throw new Error(`미션을 찾을 수 없습니다: ${code}`)
  }

  const today = getTodayKey()

  return completeMission({
    actor,
    missionId: mission.id,
    resetKey: today,
  })
}
