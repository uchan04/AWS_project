import type { User, PetSkin } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateReward, capAffinity, type RewardInput } from "@/lib/reward"
import { getToday } from "./reset"
import { dateKey, parseMonthKey, type DateKey, type MonthKey } from "./calendar"

/**
 * 그 달의 출석 완료 날짜 키 목록. 캘린더의 완료 표시는 이 값만 쓴다 —
 * attendanceTotal이나 streak로 추정하면 중간에 빠진 날이 완료로 보인다.
 *
 * claimDate는 @db.Date이고 claimAttendance()가 getToday()(KST 날짜의 UTC 자정)로 넣는다.
 * 즉 컬럼 자체가 이미 KST 날짜다. 그래서 월 범위도 UTC 자정 경계로 자르면 되고,
 * 읽을 때는 getUTC*로 키를 만든다(로컬 시간대로 읽으면 하루 밀린다).
 */
export async function listClaimedDates(userId: string, month: MonthKey): Promise<DateKey[]> {
  const { year, month: m } = parseMonthKey(month)
  const from = new Date(Date.UTC(year, m - 1, 1))
  const to = new Date(Date.UTC(m === 12 ? year + 1 : year, m === 12 ? 0 : m, 1))

  const rows = await prisma.attendanceClaim.findMany({
    // userId 조건이 빠지면 남의 출석이 보인다. 호출부는 getCurrentUser()의 id만 넘긴다
    where: { userId, claimDate: { gte: from, lt: to } },
    select: { claimDate: true },
    orderBy: { claimDate: "asc" },
  })

  return rows.map((row) =>
    dateKey(row.claimDate.getUTCFullYear(), row.claimDate.getUTCMonth() + 1, row.claimDate.getUTCDate())
  )
}

export type AttendanceResult = {
  alreadyClaimed: boolean
  cycleDay: number
  attendanceTotal: number
  reward: {
    seeds: number
    starShards: number
    affinity: number
  }
}

type ActorWithSkin = User & { activePetSkin: PetSkin | null }

// TODO: 팀 합의 필요 — 1~7일차 정확한 보상값
const ATTENDANCE_REWARDS: Record<number, RewardInput> = {
  1: { seeds: 10, starShards: 0, affinity: 0 },
  2: { seeds: 15, starShards: 0, affinity: 0 },
  3: { seeds: 20, starShards: 0, affinity: 0 },
  4: { seeds: 25, starShards: 5, affinity: 0 },
  5: { seeds: 30, starShards: 0, affinity: 0 },
  6: { seeds: 35, starShards: 0, affinity: 0 },
  7: { seeds: 40, starShards: 20, affinity: 0 },
}

/**
 * 출석 보상 수령.
 * P2002는 중복으로 보고 idempotent 결과 반환.
 */
export async function claimAttendance(actor: ActorWithSkin): Promise<AttendanceResult> {
  const todayDate = getToday()

  // 오늘 받는 것은 (attendanceTotal + 1)번째 출석이다. 1-based 요일로 바꾸면 이 식이다.
  //
  // 2026-08-22 수정: 전에는 `attendanceTotal > 0 ? ((attendanceTotal - 1) % 7) + 1 : 1`이었다.
  // 첫 출석(0)은 1로 맞았지만 두 번째 출석(1)도 1이 나와서 이후 전부 하루씩 밀렸다.
  // 7일차 보너스(씨앗 40 + 별조각 20)를 8번째 출석에 줬고, 주기 길이도 8일 → 7일로
  // 들쭉날쭉했다. 아래 반환값의 reward도 같은 옛 식을 써서 화면 표시와 실제 지급이
  // 서로 달랐다 — 이제 dayIndex 하나만 쓴다.
  const dayIndex = (actor.attendanceTotal % 7) + 1

  // 실제 지급액. 캐릭터 배율이 얹힌 값을 화면에도 그대로 보여준다
  // (전에는 base를 돌려줘서 씨앗 +15% 스킨이면 10을 받았다고 뜨고 11이 들어왔다)
  let granted = { seeds: 0, starShards: 0, affinity: 0 }

  try {
    await prisma.$transaction(async (tx) => {
      // 출석 기록 생성
      await tx.attendanceClaim.create({
        data: {
          userId: actor.id,
          claimDate: todayDate,
          dayIndex,
        },
      })

      // attendanceTotal 증가
      await tx.user.update({
        where: { id: actor.id },
        data: { attendanceTotal: { increment: 1 } },
      })

      // 보상 계산
      const baseReward = ATTENDANCE_REWARDS[dayIndex] || { seeds: 0, starShards: 0, affinity: 0 }
      const effectiveReward = calculateReward(actor.activePetSkin, baseReward)

      // 친밀도 상한 적용
      let affinityToGive = effectiveReward.affinity || 0
      if (affinityToGive > 0) {
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

      granted = {
        seeds: effectiveReward.seeds || 0,
        starShards: effectiveReward.starShards || 0,
        affinity: affinityToGive,
      }
    })

    return {
      alreadyClaimed: false,
      cycleDay: dayIndex,
      attendanceTotal: actor.attendanceTotal + 1,
      reward: granted,
    }
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      // 중복 수령
      const cycleDay = actor.attendanceTotal > 0 ? ((actor.attendanceTotal - 1) % 7) + 1 : 1
      return {
        alreadyClaimed: true,
        cycleDay,
        attendanceTotal: actor.attendanceTotal,
        reward: { seeds: 0, starShards: 0, affinity: 0 },
      }
    }
    throw err
  }
}
