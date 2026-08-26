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
export type AffinitySource = "CHAT" | "COMMUNITY"
export const CHAT_DAILY_CAP = 40
export const COMMUNITY_DAILY_CAP = 60

/** 화면용 묶음. PetView·ChatPanel이 `.CHAT`/`.COMMUNITY`로 읽는다. 값의 출처는 위 두 상수다. */
export const AFFINITY_CAP_BY_SOURCE = {
  CHAT: CHAT_DAILY_CAP,
  COMMUNITY: COMMUNITY_DAILY_CAP,
} as const

type UserWithSkin = User & { activePetSkin: PetSkin | null }

function todayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** affinityToday와 같은 날 경계를 쓴다(UTC 자정). 두 곳이 다른 기준을 쓰면 상한이 갈린다. */
function todayStart(): Date {
  return new Date(`${todayKey(new Date())}T00:00:00.000Z`)
}

/**
 * 날짜가 바뀌었으면 오늘 누계를 0으로 리셋한 값을 돌려준다. DB는 아직 건드리지 않는다.
 *
 * 두 날짜 마커를 **독립적으로** 비교한다. affinityTodayDate는 미션·출석 경로도 갱신하므로
 * affinitySourceDate와 어긋날 수 있고(schema.prisma User 주석), 한쪽만 오늘이어도
 * 나머지 한쪽은 리셋되어야 한다.
 */
function resetIfNewDay(user: UserWithSkin): UserWithSkin {
  const today = todayKey(new Date())
  let next = user

  const savedDate = user.affinityTodayDate ? todayKey(user.affinityTodayDate) : null
  if (savedDate !== today) next = { ...next, affinityToday: 0 }

  const savedSourceDate = user.affinitySourceDate ? todayKey(user.affinitySourceDate) : null
  if (savedSourceDate !== today) {
    next = { ...next, affinityTodayChat: 0, affinityTodayCommunity: 0 }
  }

  return next
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
 * 친밀도를 지급한다. 순서: 날짜 리셋 → 배율 적용 → 총 상한 → **출처 상한** → 0보다 클 때만 저장.
 * 실제 지급된 양을 반환한다(둘 중 어느 상한에든 걸리면 0).
 *
 * 총 상한(AFFINITY_DAILY_CAP = 100)과 출처 상한이 **함께** 걸리고, 더 빡빡한 쪽이 이긴다.
 * 출처별 오늘 누계는 affinityTodayChat·affinityTodayCommunity 컬럼에서 읽는다.
 */
export async function grantAffinity(
  user: UserWithSkin,
  base: number,
  source: AffinitySource,
): Promise<number> {
  const resetUser = resetIfNewDay(user)

  const want = calculateReward(resetUser.activePetSkin, { affinity: base }).affinity ?? 0
  const grantedByTotal = capAffinity(resetUser.affinityToday, want)

  const roomForSource =
    source === "CHAT"
      ? CHAT_DAILY_CAP - resetUser.affinityTodayChat
      : COMMUNITY_DAILY_CAP - resetUser.affinityTodayCommunity

  const granted = Math.max(0, Math.min(grantedByTotal, roomForSource))

  if (granted > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        affinity: { increment: granted },
        affinityToday: resetUser.affinityToday + granted,
        affinityTodayDate: new Date(),
        affinitySourceDate: new Date(),
        ...(source === "CHAT"
          ? { affinityTodayChat: resetUser.affinityTodayChat + granted }
          : { affinityTodayCommunity: resetUser.affinityTodayCommunity + granted }),
      },
    })
  }

  return granted
}
