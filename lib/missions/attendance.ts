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

  try {
    await prisma.$transaction(async (tx) => {
      // 출석 기록 생성
      const dayIndex = actor.attendanceTotal > 0 ? ((actor.attendanceTotal - 1) % 7) + 1 : 1

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
    })

    const newTotal = actor.attendanceTotal + 1
    const newCycleDay = ((newTotal - 1) % 7) + 1

    return {
      alreadyClaimed: false,
      cycleDay: newCycleDay,
      attendanceTotal: newTotal,
      reward: {
        seeds: ATTENDANCE_REWARDS[((actor.attendanceTotal - 1) % 7) + 1]?.seeds || 0,
        starShards: ATTENDANCE_REWARDS[((actor.attendanceTotal - 1) % 7) + 1]?.starShards || 0,
        affinity: ATTENDANCE_REWARDS[((actor.attendanceTotal - 1) % 7) + 1]?.affinity || 0,
      },
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
