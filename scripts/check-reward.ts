import assert from "node:assert/strict"
import type { PetSkin } from "@prisma/client"
import { AFFINITY_DAILY_CAP, calculateReward, capAffinity } from "../lib/reward"

// npm run check:reward
// calculateReward는 4명이 전부 호출한다. 시그니처나 로직을 고쳤으면 이걸 돌려본다.

function skin(effectType: PetSkin["effectType"], effectPct: number): PetSkin {
  return {
    id: "x",
    name: "테스트",
    typeCode: "HEALTH_EMOTION",
    isDefault: false,
    stageCount: 1,
    effectType,
    effectPct,
    priceShards: null,
    imageKeyBase: "pets/test",
    // PetSkin 전체를 만드는 리터럴이라 컬럼이 늘면 여기도 늘어야 한다(2026-08-24 avatarKey).
    // calculateReward는 effectType·effectPct만 보므로 값은 검사에 영향이 없다.
    avatarKey: null,
  }
}

// 스킨이 없으면 그대로 통과
assert.deepEqual(calculateReward(null, { seeds: 10 }), { seeds: 10 })

// 효과 없는 기본 펫도 그대로 통과
assert.deepEqual(calculateReward(skin("NONE", 0), { seeds: 10 }), { seeds: 10 })

// 늑대: 씨앗만 +15%
assert.deepEqual(calculateReward(skin("SEED", 15), { seeds: 10 }), { seeds: 11 })

// 다른 재화에는 배율이 붙지 않는다
assert.deepEqual(calculateReward(skin("SEED", 15), { starShards: 10 }), { starShards: 10 })

// 삵: 별조각만 +10%
assert.deepEqual(calculateReward(skin("SHARD", 10), { seeds: 10, starShards: 10 }), {
  seeds: 10,
  starShards: 11,
})

// 판다: 친밀도만 +20%
assert.deepEqual(calculateReward(skin("AFFINITY", 20), { affinity: 10 }), { affinity: 12 })

// 소수점은 버린다
assert.deepEqual(calculateReward(skin("SEED", 15), { seeds: 1 }), { seeds: 1 })

// 원본 객체를 변경하지 않는다
const base = { seeds: 10 }
calculateReward(skin("SEED", 15), base)
assert.equal(base.seeds, 10)

// 친밀도 일일 상한
assert.equal(capAffinity(0, 20), 20)
assert.equal(capAffinity(90, 20), 10)
assert.equal(capAffinity(AFFINITY_DAILY_CAP, 20), 0)
assert.equal(capAffinity(120, 20), 0)

console.log("reward 체크 통과")
