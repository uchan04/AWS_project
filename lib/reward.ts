import type { PetSkin } from "@prisma/client"

// 소유자: C. 재화 증감의 유일한 경로다. 각 기능에서 user.seeds += n 을 직접 쓰지 않는다.
// 시그니처를 바꿀 때는 전원에게 알린다. (CLAUDE.md 1절)

export type RewardInput = { seeds?: number; starShards?: number; affinity?: number }

const FIELD_BY_EFFECT = {
  SEED: "seeds",
  SHARD: "starShards",
  AFFINITY: "affinity",
} as const

/**
 * 활성 캐릭터의 고유 효과를 적용한 최종 지급량을 반환한다.
 * 호출부는 유저를 조회할 때 include: { activePetSkin: true }를 붙이고 user.activePetSkin을 넘긴다.
 */
export function calculateReward(skin: PetSkin | null, base: RewardInput): RewardInput {
  if (!skin || skin.effectType === "NONE" || skin.effectPct <= 0) return { ...base }

  const field = FIELD_BY_EFFECT[skin.effectType]
  const amount = base[field]
  if (!amount) return { ...base }

  return { ...base, [field]: Math.floor(amount * (1 + skin.effectPct / 100)) }
}

export const AFFINITY_DAILY_CAP = 100

/**
 * 친밀도 일일 상한을 적용한다. 챗봇·글쓰기·댓글이 이 상한을 공유하므로
 * 각자 따로 계산하지 말고 이 함수를 쓴다. todayTotal은 User.affinityToday다.
 */
export function capAffinity(todayTotal: number, want: number): number {
  return Math.max(0, Math.min(want, AFFINITY_DAILY_CAP - todayTotal))
}
