import assert from "node:assert/strict"
import {
  IDLE_CAP_HOURS,
  IDLE_MAX_SEEDS,
  IDLE_SEEDS_PER_HOUR,
  MS_PER_IDLE_SEED,
  applySeeds,
  cappedStage,
  compareCosmetics,
  expProgress,
  idleAccrual,
} from "../lib/pet"
import { EVOLUTION_LEVEL, SEED_TO_EXP, expToNextLevel } from "../lib/types"

// npm run check:pet
// 성장 곡선과 진화 임계값은 SPEC.md 5절 수치다. 로직을 고쳤으면 이걸 돌려본다.
// 테스트 프레임워크는 쓰지 않는다 (CLAUDE.md 8절). check-reward.ts와 같은 방식이다.
//
// 2026-08-19: 씨앗 1 = 경험치 10으로 바뀌었다 (이전 1:1). 아래 기대값은 이 비율 기준이다.
// 비율이 또 바뀌면 "레벨업 직전"·"소수점 버림" 케이스의 씨앗 수를 다시 잡아야 한다.
// 그 두 케이스는 레벨업이 일어나지 않는 구간이어야 의도가 유지된다.

const start = { level: 1, exp: 0, evolutionStage: 1 }

// 비율 자체를 먼저 못 박는다. 이 값이 바뀌면 아래 기대값이 전부 무효다
assert.equal(SEED_TO_EXP, 10)

// 씨앗 1 = 경험치 10
assert.equal(applySeeds(start, 1).exp, 10)
assert.equal(applySeeds(start, 9).exp, 90)

// 필요 경험치 = 레벨 × 100 (비율 변경과 무관하게 그대로다)
assert.equal(expToNextLevel(1), 100)
assert.equal(expToNextLevel(2), 200)

// 1→2 레벨업은 정확히 씨앗 10개(경험치 100). 9개까지는 레벨이 오르지 않는다
assert.equal(applySeeds(start, 9).level, 1)
assert.deepEqual(
  { level: applySeeds(start, 10).level, exp: applySeeds(start, 10).exp },
  { level: 2, exp: 0 },
)
assert.equal(applySeeds(start, 10).gainedLevels, 1)

// 남는 경험치는 다음 레벨로 넘어간다. 씨앗 15개 = 경험치 150
assert.deepEqual(
  { level: applySeeds(start, 15).level, exp: applySeeds(start, 15).exp },
  { level: 2, exp: 50 },
)

// 한 번에 여러 레벨이 오른다. 1→2(100) + 2→3(200) = 300 = 씨앗 30개
assert.deepEqual(
  { level: applySeeds(start, 30).level, exp: applySeeds(start, 30).exp },
  { level: 3, exp: 0 },
)
assert.equal(applySeeds(start, 30).gainedLevels, 2)

// 0 이하 투입은 상태를 바꾸지 않는다
assert.deepEqual(applySeeds({ level: 4, exp: 30, evolutionStage: 1 }, 0), {
  level: 4,
  exp: 30,
  evolutionStage: 1,
  gainedLevels: 0,
  evolvedTo: null,
})
assert.equal(applySeeds(start, -10).gainedLevels, 0)

// 소수점 씨앗은 버린다. 9.9 → 9개 → 경험치 90 (레벨업 전 구간이라 버림이 드러난다)
assert.equal(applySeeds(start, 9.9).exp, 90)

// 원본 객체를 변경하지 않는다
const base = { level: 1, exp: 0, evolutionStage: 1 }
applySeeds(base, 500)
assert.deepEqual(base, { level: 1, exp: 0, evolutionStage: 1 })

// 진화: 5레벨 2단 / 15레벨 3단 (SPEC.md 5절)
assert.equal(EVOLUTION_LEVEL.STAGE2, 5)
assert.equal(EVOLUTION_LEVEL.STAGE3, 15)
assert.equal(cappedStage(4, 3), 1)
assert.equal(cappedStage(5, 3), 2)
assert.equal(cappedStage(14, 3), 2)
assert.equal(cappedStage(15, 3), 3)

// 4레벨에서 5레벨로 올리면 2단 진화 연출이 뜬다. 4→5는 경험치 400 = 씨앗 40개
const toStage2 = applySeeds({ level: 4, exp: 0, evolutionStage: 1 }, 40)
assert.equal(toStage2.level, 5)
assert.equal(toStage2.evolvedTo, 2)

// 이미 2단이면 같은 단계에서 연출이 다시 뜨지 않는다
assert.equal(applySeeds({ level: 5, exp: 0, evolutionStage: 2 }, 10).evolvedTo, null)

// 한 번에 1단 → 3단으로 뛰면 최종 단계로 연출한다
// 1→15레벨 누적 경험치 = 100×(1+2+…+14) = 10,500 = 씨앗 1,050개
const jump = applySeeds({ level: 1, exp: 0, evolutionStage: 1 }, 1050)
assert.equal(jump.level, EVOLUTION_LEVEL.STAGE3)
assert.equal(jump.exp, 0)
assert.equal(jump.evolvedTo, 3)

// 친밀도 전용 캐릭터는 stageCount = 1이라 진화하지 않는다
assert.equal(cappedStage(20, 1), 1)
const single = applySeeds({ level: 4, exp: 0, evolutionStage: 1 }, 40, 1)
assert.equal(single.level, 5)
assert.equal(single.evolutionStage, 1)
assert.equal(single.evolvedTo, null)

// 경험치 바 비율 (경험치를 직접 받으므로 비율 변경과 무관하다)
assert.equal(expProgress(1, 0), 0)
assert.equal(expProgress(1, 50), 0.5)
assert.equal(expProgress(2, 100), 0.5)
assert.equal(expProgress(1, 100), 1)
assert.equal(expProgress(1, 999), 1)
assert.equal(expProgress(1, -5), 0)

// ── 방치형 자동 획득 (SPEC.md 5절) ────────────────────────────────────────────

// 수치를 먼저 못 박는다. 상한 12시간분은 명세값, 2/시간은 C가 정한 값이다
assert.equal(IDLE_CAP_HOURS, 12)
assert.equal(IDLE_SEEDS_PER_HOUR, 2)
assert.equal(IDLE_MAX_SEEDS, 24)
assert.equal(MS_PER_IDLE_SEED, 30 * 60 * 1000) // 30분에 1개

const T0 = new Date("2026-08-19T00:00:00.000Z")
const at = (ms: number) => new Date(T0.getTime() + ms)
const MIN = 60 * 1000
const HOUR = 60 * MIN

// 첫 접속은 소급 지급하지 않고 기준 시각만 심는다
const first = idleAccrual(null, T0)
assert.equal(first.seeds, 0)
assert.equal(first.nextClaimAt.getTime(), T0.getTime())
assert.equal(first.capped, false)

// 30분에 1개. 29분에는 0개다
assert.equal(idleAccrual(T0, at(29 * MIN)).seeds, 0)
assert.equal(idleAccrual(T0, at(30 * MIN)).seeds, 1)
assert.equal(idleAccrual(T0, at(HOUR)).seeds, IDLE_SEEDS_PER_HOUR)
assert.equal(idleAccrual(T0, at(6 * HOUR)).seeds, 12)

// 자투리 시간은 다음 수령으로 넘어간다. 45분 = 1개 + 15분치
const partial = idleAccrual(T0, at(45 * MIN))
assert.equal(partial.seeds, 1)
assert.equal(partial.nextClaimAt.getTime(), at(30 * MIN).getTime()) // now가 아니다
assert.equal(partial.msToNextSeed, 15 * MIN)

// 자투리를 넘긴 뒤 15분 더 지나면 1개가 더 쌓인다 (자투리가 버려지지 않는지)
assert.equal(idleAccrual(partial.nextClaimAt, at(60 * MIN)).seeds, 1)

// 상한: 12시간분 24개에서 멈춘다. 3일을 비워도 같다
assert.equal(idleAccrual(T0, at(12 * HOUR)).seeds, IDLE_MAX_SEEDS)
assert.equal(idleAccrual(T0, at(72 * HOUR)).seeds, IDLE_MAX_SEEDS)

// 상한을 넘긴 초과분은 버린다 — 기준 시각이 now로 밀린다.
// 이게 아니면 24개를 받은 직후에 또 24개가 남아 무한 누적이 된다
const over = idleAccrual(T0, at(72 * HOUR))
assert.equal(over.capped, true)
assert.equal(over.nextClaimAt.getTime(), at(72 * HOUR).getTime())
assert.equal(idleAccrual(over.nextClaimAt, at(72 * HOUR)).seeds, 0)

// 상한 직전은 capped가 아니고 자투리를 넘긴다
const justUnder = idleAccrual(T0, at(12 * HOUR - MIN))
assert.equal(justUnder.capped, false)
assert.equal(justUnder.seeds, 23)
assert.equal(justUnder.nextClaimAt.getTime(), at(11.5 * HOUR).getTime())

// 기준 시각이 미래면(시계 오차) 지급하지 않고 기준을 그대로 둔다
const skewed = idleAccrual(at(HOUR), T0)
assert.equal(skewed.seeds, 0)
assert.equal(skewed.nextClaimAt.getTime(), at(HOUR).getTime())

// 같은 시각이면 0개
assert.equal(idleAccrual(T0, T0).seeds, 0)

// ── 치장 목록 정렬 ────────────────────────────────────────────────────────────
// 화면과 API가 같은 함수를 쓴다. 순서가 바뀌면 여기서 걸린다

const cos = (name: string, slot: "HAT" | "SCARF" | "BACKGROUND", rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY") =>
  ({ name, slot, rarity }) as const

assert.deepEqual(
  [
    cos("이끼 배경", "BACKGROUND", "COMMON"),
    cos("노을 목도리", "SCARF", "LEGENDARY"),
    cos("새벽 목도리", "SCARF", "COMMON"),
    cos("이끼 모자", "HAT", "EPIC"),
    cos("노을 모자", "HAT", "COMMON"),
  ]
    .sort(compareCosmetics)
    .map((item) => item.name),
  // 슬롯(모자 → 목도리 → 배경) → 등급(일반 → 희귀 → 영웅 → 전설) 순
  ["노을 모자", "이끼 모자", "새벽 목도리", "노을 목도리", "이끼 배경"],
)

// 슬롯·등급이 같으면 이름 가나다순 (매 요청마다 순서가 흔들리지 않게)
assert.deepEqual(
  [cos("이끼 모자", "HAT", "EPIC"), cos("밤별 모자", "HAT", "EPIC")]
    .sort(compareCosmetics)
    .map((item) => item.name),
  ["밤별 모자", "이끼 모자"],
)

console.log("pet 체크 통과")
