import type { PetSkin, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateReward, capAffinity } from "@/lib/reward"

// 친밀도 지급의 유일한 경로. 커뮤니티(글·댓글·모임)와 챗봇이 이 함수를 공유한다.
// 호출부에서 user.affinity += n 같은 코드를 절대 쓰지 않는다.

export const POST_AFFINITY = 20
export const COMMENT_AFFINITY = 5
export const CHAT_TURN_AFFINITY = 5
// 오프라인 모임 신규 신청. 재신청(취소 후 재신청)에는 지급하지 않는다.
export const MEETUP_JOIN_AFFINITY = 10

/**
 * 출처별 하루 상한 (2026-08-25 사용자 결정).
 *
 * 전에는 총 상한 100 하나뿐이라 **챗봇 20턴으로 하루 상한을 다 채울 수 있었다.**
 * 친밀도는 상점(배경)의 유일한 화폐이므로, 그러면 가장 쉬운 경로가 가장 어려운 경로와
 * 똑같이 지불한다 — 사람과 닿을 재화 동기가 0이 된다.
 *
 * 두 값의 합이 총 상한 100과 같다(`AFFINITY_DAILY_CAP`). 그래서 총 상한이
 * 출처 상한보다 먼저 걸리는 일이 없고, 아래 "출처별 기지급량" 계산이 정확해진다.
 */
export const AFFINITY_CAP_BY_SOURCE = { CHAT: 40, COMMUNITY: 60 } as const
export type AffinitySource = keyof typeof AFFINITY_CAP_BY_SOURCE

type UserWithSkin = User & { activePetSkin: PetSkin | null }

function todayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** affinityToday와 같은 날 경계를 쓴다(UTC 자정). 두 곳이 다른 기준을 쓰면 상한이 갈린다. */
function todayStart(): Date {
  return new Date(`${todayKey(new Date())}T00:00:00.000Z`)
}

/** affinityTodayDate가 오늘이 아니면 affinityToday를 0으로 리셋한 값을 돌려준다. DB는 아직 건드리지 않는다. */
function resetIfNewDay(user: UserWithSkin): UserWithSkin {
  const savedDate = user.affinityTodayDate ? todayKey(user.affinityTodayDate) : null
  if (savedDate === todayKey(new Date())) return user
  return { ...user, affinityToday: 0 }
}

/**
 * 오늘 챗봇으로 받은 친밀도. **컬럼을 새로 만들지 않고 ChatMessage에서 유도한다.**
 *
 * 정확한 이유: USER 메시지 1건 = 정확히 `CHAT_TURN_AFFINITY`이고, 챗봇 상한(40)이
 * 총 상한(100)보다 먼저 걸리므로 지급이 중간에 다른 이유로 깎이지 않는다.
 * 그래서 `min(상한, 턴수 × 5)`가 실제 지급 누계와 같다.
 *
 * 마이그레이션을 피한 것이 목적이다 — 발표 전에 공유 DB 스키마를 바꾸지 않는다.
 * `ChatMessage`에 `@@index([userId, createdAt])`가 있어 이 count는 인덱스만 읽는다.
 */
export async function chatAffinityToday(userId: string): Promise<number> {
  const turns = await prisma.chatMessage.count({
    where: { userId, role: "USER", createdAt: { gte: todayStart() } },
  })
  return Math.min(AFFINITY_CAP_BY_SOURCE.CHAT, turns * CHAT_TURN_AFFINITY)
}

/**
 * 친밀도를 지급한다. 순서: 날짜 리셋 → 배율 적용 → **출처 상한** → 총 상한 → 0보다 클 때만 저장.
 * 실제 지급된 양을 반환한다(상한에 걸리면 0).
 *
 * `source`를 넘기지 않으면 `COMMUNITY`다 — 글·댓글·모임이 전부 그쪽이고,
 * 챗봇 라우트 한 곳만 `"CHAT"`을 넘긴다.
 *
 * @param alreadyFromSource 이 출처로 오늘 이미 받은 양. 챗봇은 메시지를 만든 **뒤에**
 *   이 함수를 부르므로 방금 만든 1턴을 빼고 넘겨야 한다. 넘기지 않으면 여기서 계산한다.
 */
export async function grantAffinity(
  user: UserWithSkin,
  base: number,
  source: AffinitySource = "COMMUNITY",
  alreadyFromSource?: number,
): Promise<number> {
  const resetUser = resetIfNewDay(user)

  const want = calculateReward(resetUser.activePetSkin, { affinity: base }).affinity ?? 0

  const earned =
    alreadyFromSource ??
    (source === "CHAT"
      ? await chatAffinityToday(user.id)
      : // 출처가 둘뿐이므로 커뮤니티 몫은 "전체 − 챗봇"이다. 컬럼을 늘리지 않는 대가로
        // 여기서 챗봇 누계를 한 번 읽는다(인덱스 count 1회).
        Math.max(0, resetUser.affinityToday - (await chatAffinityToday(user.id))))

  const room = Math.max(0, AFFINITY_CAP_BY_SOURCE[source] - earned)
  const granted = capAffinity(resetUser.affinityToday, Math.min(want, room))

  if (granted > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        affinity: { increment: granted },
        affinityToday: resetUser.affinityToday + granted,
        affinityTodayDate: new Date(),
      },
    })
  }

  return granted
}
