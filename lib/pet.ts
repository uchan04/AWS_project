import { SEED_TO_EXP, evolutionStageFor, expToNextLevel } from "@/lib/types"

// 소유자: C. 펫 성장 계산. 순수 함수만 둔다 (DB·요청 객체를 모르게 유지해야 체크 스크립트로 검증된다).
// 수치 근거는 SPEC.md 5절. 곡선 상수는 lib/types.ts(A 소유)에 있으므로 여기서 다시 정의하지 않는다.
// 로직을 고쳤으면 npm run check:pet 을 돌린다.

export type Growth = {
  level: number
  exp: number
  evolutionStage: number
}

export type GrowthResult = Growth & {
  /** 이번 투입으로 오른 레벨 수. 0이면 레벨업 없음 */
  gainedLevels: number
  /** 진화 연출을 띄울 단계. 단계가 올라가지 않았으면 null */
  evolvedTo: number | null
}

/**
 * 진화 단계는 레벨로 정해지지만 스킨이 가진 단계 수를 넘지 못한다.
 * 친밀도 전용 캐릭터(늑대·삵·판다)는 stageCount = 1이라 진화하지 않는다. (SPEC.md 5절)
 */
export function cappedStage(level: number, stageCount: number): number {
  return Math.min(evolutionStageFor(level), Math.max(1, stageCount))
}

/**
 * 씨앗을 경험치로 넣은 뒤의 성장 상태를 계산한다.
 * 씨앗을 몰아서 넣으면 레벨이 여러 개 한꺼번에 오를 수 있어 while로 처리한다.
 *
 * 씨앗 차감은 이 함수가 하지 않는다. 호출부가 트랜잭션 안에서 함께 처리한다.
 */
export function applySeeds(current: Growth, seeds: number, stageCount = 3): GrowthResult {
  // level이 0 이하로 들어오면 expToNextLevel이 0이 되어 while이 끝나지 않는다.
  const startLevel = Math.max(1, Math.floor(current.level))
  const startExp = Math.max(0, Math.floor(current.exp))
  const add = Math.floor(seeds) * SEED_TO_EXP

  if (add <= 0) {
    return {
      level: startLevel,
      exp: startExp,
      evolutionStage: cappedStage(startLevel, stageCount),
      gainedLevels: 0,
      evolvedTo: null,
    }
  }

  let level = startLevel
  let exp = startExp + add
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level)
    level += 1
  }

  const stage = cappedStage(level, stageCount)
  const before = cappedStage(startLevel, stageCount)

  return {
    level,
    exp,
    evolutionStage: stage,
    gainedLevels: level - startLevel,
    evolvedTo: stage > before ? stage : null,
  }
}

/** 경험치 바 채움 비율 0~1. 화면에서 width %로 쓴다. */
export function expProgress(level: number, exp: number): number {
  const need = expToNextLevel(Math.max(1, level))
  if (need <= 0) return 0
  return Math.min(1, Math.max(0, exp / need))
}
