import type { PetSkin, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateReward, capAffinity } from "@/lib/reward"

// 친밀도 지급의 유일한 경로. 커뮤니티(글·댓글)와 챗봇이 이 함수를 공유한다.
// 호출부에서 user.affinity += n 같은 코드를 절대 쓰지 않는다.

export const POST_AFFINITY = 20
export const COMMENT_AFFINITY = 5
export const CHAT_TURN_AFFINITY = 5

type UserWithSkin = User & { activePetSkin: PetSkin | null }

function todayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** affinityTodayDate가 오늘이 아니면 affinityToday를 0으로 리셋한 값을 돌려준다. DB는 아직 건드리지 않는다. */
function resetIfNewDay(user: UserWithSkin): UserWithSkin {
  const savedDate = user.affinityTodayDate ? todayKey(user.affinityTodayDate) : null
  if (savedDate === todayKey(new Date())) return user
  return { ...user, affinityToday: 0 }
}

/**
 * 친밀도를 지급한다. 순서: 날짜 리셋 → 배율 적용 → 상한 적용 → 0보다 클 때만 저장.
 * 실제 지급된 양을 반환한다(하루 상한에 걸리면 0).
 */
export async function grantAffinity(user: UserWithSkin, base: number): Promise<number> {
  const resetUser = resetIfNewDay(user)

  const want = calculateReward(resetUser.activePetSkin, { affinity: base }).affinity ?? 0
  const granted = capAffinity(resetUser.affinityToday, want)

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
