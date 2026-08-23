import type { User } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { kstDateKey } from "./calendar"

/**
 * 서버 기준(Asia/Seoul) 오늘 날짜를 YYYY-MM-DD로 반환.
 * 실제 계산은 calendar.ts가 한다 — 출석 캘린더가 클라이언트에서 같은 규칙을 써야 하고,
 * 이 모듈은 prisma를 물고 있어 클라이언트에서 import할 수 없다.
 */
export function getTodayKey(): string {
  return kstDateKey(new Date())
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
 *
 * 반환: 업데이트된 user. streak가 끊겼거나 lastMissionResetAt이 갱신되면 DB에서 다시 읽는다.
 */
export async function ensureMissionReset(user: User): Promise<User> {
  const today = getToday()
  const last = user.lastMissionResetAt

  if (last && last >= today) {
    // 같은 날 반복 조회 → 초기화 필요 없음
    return user
  }

  // 날짜 바뀜 → lastMissionResetAt 갱신
  let updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastMissionResetAt: today },
  })

  // streak 만료 체크
  if (user.lastStreakDate) {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (user.lastStreakDate < yesterday && user.streakCount > 0) {
      // 어제도 아니고 그보다 오래됐으면 streak 끊김
      updated = await prisma.user.update({
        where: { id: user.id },
        data: { streakCount: 0 },
      })
    }
  }

  return updated
}
