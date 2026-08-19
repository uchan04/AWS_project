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

// ── 방치형 자동 획득 (SPEC.md 5절) ────────────────────────────────────────────
//
// SPEC.md 5절은 "lastIdleClaimAt과 현재 시각의 차이로 씨앗을 누적하고 상한 12시간분"까지만
// 정한다. 시간당 개수는 명세에 없어서 C가 정했다 — 근거는 아래.
//
//   일일 미션 5개 = 60씨앗/일 (prisma/seed/missions.ts: 10+10+10+15+15)
//   방치형 2/시간 → 12시간 상한 = 한 번에 24씨앗, 하루 최대 48씨앗
//
// 방치형이 미션보다 많으면 "미션을 하러 오는" 앱이 아니라 "켜 두는" 앱이 된다.
// 그래서 미션 경로보다 낮게 뒀다. 팀에서 다시 정하면 이 상수 하나만 고친다
// (scripts/check-pet.ts가 값을 못 박아 두므로 조용히 바뀌면 거기서 걸린다).
export const IDLE_SEEDS_PER_HOUR = 2
/** 무한 누적 방지 상한. SPEC.md 5절이 정한 값이다 */
export const IDLE_CAP_HOURS = 12

const MS_PER_HOUR = 60 * 60 * 1000
/** 씨앗 1개가 쌓이는 데 걸리는 시간. 2/시간이면 30분 */
export const MS_PER_IDLE_SEED = MS_PER_HOUR / IDLE_SEEDS_PER_HOUR
/** 한 번에 받을 수 있는 최대 개수 (배율 적용 전) */
export const IDLE_MAX_SEEDS = IDLE_CAP_HOURS * IDLE_SEEDS_PER_HOUR

export type IdleAccrual = {
  /** 캐릭터 배율 적용 **전** 기본 개수. 호출부가 calculateReward()에 넣는다 */
  seeds: number
  /** 수령 후 저장할 lastIdleClaimAt */
  nextClaimAt: Date
  /** 다음 1개가 쌓이기까지 남은 밀리초. capped면 0 — 받아 가야 다시 쌓인다 */
  msToNextSeed: number
  /** 상한에 닿아 누적이 멈춰 있었는지. 화면 문구에 쓴다 */
  capped: boolean
}

/**
 * 접속 시점까지 쌓인 방치형 씨앗을 계산한다. 지급하지는 않는다 (순수 함수).
 * now를 인자로 받는 이유는 check:pet에서 시각을 고정해 검증하기 위해서다.
 */
export function idleAccrual(lastClaimAt: Date | null, now: Date): IdleAccrual {
  // 첫 접속은 기준 시각이 없다. 소급 지급하지 않고 지금을 기준으로 심는다.
  // 가입 즉시 12시간분을 주면 방치형이 아니라 가입 보너스가 된다 (명세에 없는 지급).
  if (!lastClaimAt) {
    return { seeds: 0, nextClaimAt: now, msToNextSeed: MS_PER_IDLE_SEED, capped: false }
  }

  const elapsed = now.getTime() - lastClaimAt.getTime()

  // 기준 시각이 미래면(시계 오차·수동 수정) 지급하지 않고 기준을 그대로 둔다
  if (elapsed <= 0) {
    return { seeds: 0, nextClaimAt: lastClaimAt, msToNextSeed: MS_PER_IDLE_SEED, capped: false }
  }

  const capMs = IDLE_CAP_HOURS * MS_PER_HOUR
  const capped = elapsed >= capMs
  const usable = capped ? capMs : elapsed
  const seeds = Math.floor(usable / MS_PER_IDLE_SEED)
  const creditedMs = seeds * MS_PER_IDLE_SEED

  // 상한을 넘긴 초과분은 버린다 (무한 누적 방지).
  // 넘기지 않았으면 1개에 못 미치는 자투리 시간을 다음 수령으로 넘긴다 —
  // 기준을 now로 밀어 버리면 자주 들여다보는 유저가 영구히 손해를 본다.
  const nextClaimAt = capped ? now : new Date(lastClaimAt.getTime() + creditedMs)

  return {
    seeds,
    nextClaimAt,
    msToNextSeed: capped ? 0 : MS_PER_IDLE_SEED - (usable - creditedMs),
    capped,
  }
}
