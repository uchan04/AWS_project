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
 * 출처별 하루 상한 (2026-08-26 사용자 결정).
 *
 * 전에는 총 상한 100 하나뿐이라 **챗봇 20턴으로 하루 상한을 다 채울 수 있었다.**
 * 친밀도는 펫 외출의 유일한 화폐이므로, 그러면 가장 쉬운 경로가 가장 어려운 경로와
 * 똑같이 지불한다 — 사람과 닿을 재화 동기가 0이 된다.
 *
 * 두 값의 합이 총 상한 100과 같다(`AFFINITY_DAILY_CAP`).
 */
export const AFFINITY_CAP_BY_SOURCE = { CHAT: 40, COMMUNITY: 60 } as const
export type AffinitySource = keyof typeof AFFINITY_CAP_BY_SOURCE

type UserWithSkin = User & { activePetSkin: PetSkin | null }

function todayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isToday(date: Date | null): boolean {
  return date !== null && todayKey(date) === todayKey(new Date())
}

/**
 * 오늘 출처별로 이미 받은 양. **`User`의 전용 컬럼을 읽는다**(D가 만든 3컬럼,
 * `20260826150000_affinity_source_split`).
 *
 * 전에는 `ChatMessage`의 오늘 `USER` 메시지 수 × 5로 유도했다. **그 방식에 버그가 있었다** —
 * `lib/missions/completion.ts:159`와 `attendance.ts:121`이 `grantAffinity()`를 거치지 않고
 * `affinityToday`를 직접 증가시킨다. 커뮤니티 몫을 `전체 − 챗봇`으로 계산하면 그 미션 몫이
 * 커뮤니티에 잘못 얹혀 상한이 일찍 걸린다. 지금은 모든 미션의 `rewardAffinity`가 0이라
 * 잠들어 있지만, 누가 그 값을 올리는 순간 조용히 깨진다.
 *
 * **날짜 마커가 `affinityTodayDate`와 따로인 것도 같은 이유다.** 미션 경로가 그 마커를 먼저
 * 리셋하면 새 컬럼만 리셋을 건너뛰어 전날 값이 남는다.
 */
function todayBySource(user: Pick<User, "affinityTodayChat" | "affinityTodayCommunity" | "affinitySourceDate">): {
  CHAT: number
  COMMUNITY: number
} {
  if (!isToday(user.affinitySourceDate)) return { CHAT: 0, COMMUNITY: 0 }
  return { CHAT: user.affinityTodayChat, COMMUNITY: user.affinityTodayCommunity }
}

/** 챗봇 게이지가 쓰는 값. 화면과 API가 같은 판정을 쓴다 */
export async function chatAffinityToday(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { affinityTodayChat: true, affinityTodayCommunity: true, affinitySourceDate: true },
  })
  if (!u) return 0
  return todayBySource(u).CHAT
}

/** affinityTodayDate가 오늘이 아니면 affinityToday를 0으로 리셋한 값을 돌려준다. DB는 아직 건드리지 않는다. */
function resetIfNewDay(user: UserWithSkin): UserWithSkin {
  if (isToday(user.affinityTodayDate)) return user
  return { ...user, affinityToday: 0 }
}

/**
 * 친밀도를 지급한다. 순서: 날짜 리셋 → 배율 적용 → **출처 상한** → 총 상한 → 0보다 클 때만 저장.
 * 실제 지급된 양을 반환한다(상한에 걸리면 0).
 *
 * `source`를 넘기지 않으면 `COMMUNITY`다 — 글·댓글·모임이 전부 그쪽이고,
 * 챗봇 라우트 한 곳만 `"CHAT"`을 넘긴다.
 */
export async function grantAffinity(
  user: UserWithSkin,
  base: number,
  source: AffinitySource = "COMMUNITY",
): Promise<number> {
  const resetUser = resetIfNewDay(user)
  const earned = todayBySource(user)

  const want = calculateReward(resetUser.activePetSkin, { affinity: base }).affinity ?? 0
  const room = Math.max(0, AFFINITY_CAP_BY_SOURCE[source] - earned[source])
  const granted = capAffinity(resetUser.affinityToday, Math.min(want, room))

  if (granted > 0) {
    const now = new Date()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        affinity: { increment: granted },
        affinityToday: resetUser.affinityToday + granted,
        affinityTodayDate: now,
        // 출처 컬럼은 **절대값으로 쓴다.** increment를 쓰면 날짜가 바뀐 날 전날 값에 더해진다
        affinityTodayChat: earned.CHAT + (source === "CHAT" ? granted : 0),
        affinityTodayCommunity: earned.COMMUNITY + (source === "COMMUNITY" ? granted : 0),
        affinitySourceDate: now,
      },
    })
  }

  return granted
}
