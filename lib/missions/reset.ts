import type { User } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const TZ = "Asia/Seoul"

/** 서버 기준 오늘 날짜를 YYYY-MM-DD로 반환 */
export function getTodayKey(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: TZ }).split(" ")[0]
}

/** 날짜 비교용 Date 객체 (UTC 자정) */
export function getToday(): Date {
  const str = getTodayKey()
  return new Date(`${str}T00:00:00.000Z`)
}

/**
 * 접속 시점 초기화.
 * lastMissionResetAt과 오늘을 비교해 날짜가 달라졌으면 리셋 처리.
 * 과거 UserMission은 삭제하지 않는다 (누적 기록 보존).
 * 만료된 streakCount는 0으로 정리한다.
 */
export async function ensureMissionReset(user: User): Promise<void> {
  const today = getToday()
  const last = user.lastMissionResetAt

  if (last && last >= today) {
    // 같은 날 반복 조회 → 초기화 필요 없음
    return
  }

  // 날짜 바뀜 → lastMissionResetAt 갱신
  await prisma.user.update({
    where: { id: user.id },
    data: { lastMissionResetAt: today },
  })

  // streak 만료 체크
  if (user.lastStreakDate) {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (user.lastStreakDate < yesterday && user.streakCount > 0) {
      // 어제도 아니고 그보다 오래됐으면 streak 끊김
      await prisma.user.update({
        where: { id: user.id },
        data: { streakCount: 0 },
      })
    }
  }
}
