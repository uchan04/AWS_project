import assert from "node:assert/strict"
import { applySeeds, cappedStage, expProgress } from "../lib/pet"
import { EVOLUTION_LEVEL, expToNextLevel } from "../lib/types"

// npm run check:pet
// 성장 곡선과 진화 임계값은 SPEC.md 5절 수치다. 로직을 고쳤으면 이걸 돌려본다.
// 테스트 프레임워크는 쓰지 않는다 (CLAUDE.md 8절). check-reward.ts와 같은 방식이다.

const start = { level: 1, exp: 0, evolutionStage: 1 }

// 씨앗 1 = 경험치 1
assert.equal(applySeeds(start, 1).exp, 1)
assert.equal(applySeeds(start, 50).exp, 50)

// 필요 경험치 = 레벨 × 100
assert.equal(expToNextLevel(1), 100)
assert.equal(expToNextLevel(2), 200)

// 1→2 레벨업은 정확히 100
assert.equal(applySeeds(start, 99).level, 1)
assert.deepEqual(
  { level: applySeeds(start, 100).level, exp: applySeeds(start, 100).exp },
  { level: 2, exp: 0 },
)
assert.equal(applySeeds(start, 100).gainedLevels, 1)

// 남는 경험치는 다음 레벨로 넘어간다
assert.deepEqual(
  { level: applySeeds(start, 150).level, exp: applySeeds(start, 150).exp },
  { level: 2, exp: 50 },
)

// 한 번에 여러 레벨이 오른다. 1→2(100) + 2→3(200) = 300
assert.deepEqual(
  { level: applySeeds(start, 300).level, exp: applySeeds(start, 300).exp },
  { level: 3, exp: 0 },
)
assert.equal(applySeeds(start, 300).gainedLevels, 2)

// 0 이하 투입은 상태를 바꾸지 않는다
assert.deepEqual(applySeeds({ level: 4, exp: 30, evolutionStage: 1 }, 0), {
  level: 4,
  exp: 30,
  evolutionStage: 1,
  gainedLevels: 0,
  evolvedTo: null,
})
assert.equal(applySeeds(start, -10).gainedLevels, 0)

// 소수점 씨앗은 버린다
assert.equal(applySeeds(start, 10.9).exp, 10)

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

// 4레벨에서 5레벨로 올리면 2단 진화 연출이 뜬다
const toStage2 = applySeeds({ level: 4, exp: 0, evolutionStage: 1 }, 400)
assert.equal(toStage2.level, 5)
assert.equal(toStage2.evolvedTo, 2)

// 이미 2단이면 같은 단계에서 연출이 다시 뜨지 않는다
assert.equal(applySeeds({ level: 5, exp: 0, evolutionStage: 2 }, 100).evolvedTo, null)

// 한 번에 1단 → 3단으로 뛰면 최종 단계로 연출한다
const jump = applySeeds({ level: 1, exp: 0, evolutionStage: 1 }, 20000)
assert.ok(jump.level >= EVOLUTION_LEVEL.STAGE3)
assert.equal(jump.evolvedTo, 3)

// 친밀도 전용 캐릭터는 stageCount = 1이라 진화하지 않는다
assert.equal(cappedStage(20, 1), 1)
const single = applySeeds({ level: 4, exp: 0, evolutionStage: 1 }, 400, 1)
assert.equal(single.level, 5)
assert.equal(single.evolutionStage, 1)
assert.equal(single.evolvedTo, null)

// 경험치 바 비율
assert.equal(expProgress(1, 0), 0)
assert.equal(expProgress(1, 50), 0.5)
assert.equal(expProgress(2, 100), 0.5)
assert.equal(expProgress(1, 100), 1)
assert.equal(expProgress(1, 999), 1)
assert.equal(expProgress(1, -5), 0)

console.log("pet 체크 통과")
