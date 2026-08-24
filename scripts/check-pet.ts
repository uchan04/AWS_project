import assert from "node:assert/strict"
import { COSMETICS, PET_SKINS, PRICE_BY_RARITY } from "../prisma/seed/items"
import {
  BACKGROUNDS,
  IDLE_CAP_HOURS,
  IDLE_MAX_SEEDS,
  IDLE_SEEDS_PER_HOUR,
  MS_PER_IDLE_SEED,
  PET_GREETINGS,
  PET_IDLE_LINES,
  animalEmoji,
  applySeeds,
  cappedStage,
  compareCosmetics,
  cosmeticLabel,
  expProgress,
  greetingFor,
  idleAccrual,
  lineIndex,
} from "../lib/pet"
import { EVOLUTION_LEVEL, SEED_TO_EXP, TRIBE, expToNextLevel } from "../lib/types"

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

// 진화: 5레벨 2단 / 15레벨 3단 / 25레벨 4단 (SPEC.md 5절)
// 2026-08-21: S3에 종당 4장이 있고 4단 진화가 계획된 것이라 3단 → 4단으로 늘렸다
assert.equal(EVOLUTION_LEVEL.STAGE2, 5)
assert.equal(EVOLUTION_LEVEL.STAGE3, 15)
assert.equal(EVOLUTION_LEVEL.STAGE4, 25)
assert.equal(cappedStage(4, 4), 1)
assert.equal(cappedStage(5, 4), 2)
assert.equal(cappedStage(14, 4), 2)
assert.equal(cappedStage(15, 4), 3)
assert.equal(cappedStage(24, 4), 3)
assert.equal(cappedStage(25, 4), 4)
// 4단이 최종이다. 그 위 레벨에서도 5단으로 새지 않는다
assert.equal(cappedStage(999, 4), 4)
// stageCount가 3인 옛 스킨 행이 남아 있어도 4단으로 새지 않는다(실 DB가 아직 3이다)
assert.equal(cappedStage(25, 3), 3)

// 4레벨에서 5레벨로 올리면 2단 진화 연출이 뜬다. 4→5는 경험치 400 = 씨앗 40개
const toStage2 = applySeeds({ level: 4, exp: 0, evolutionStage: 1 }, 40)
assert.equal(toStage2.level, 5)
assert.equal(toStage2.evolvedTo, 2)

// 이미 2단이면 같은 단계에서 연출이 다시 뜨지 않는다
assert.equal(applySeeds({ level: 5, exp: 0, evolutionStage: 2 }, 10).evolvedTo, null)

// 14 → 15레벨이면 3단 연출이 뜬다. 14→15는 경험치 1,400 = 씨앗 140개
const toStage3 = applySeeds({ level: 14, exp: 0, evolutionStage: 2 }, 140)
assert.equal(toStage3.level, EVOLUTION_LEVEL.STAGE3)
assert.equal(toStage3.evolvedTo, 3)

// 한 번에 1단 → 4단으로 뛰면 최종 단계로 연출한다.
// 누적 씨앗 = 5 × N × (N-1) 이므로 1→25레벨은 5 × 25 × 24 = 3,000개다
// (경험치로는 100×(1+2+…+24) = 30,000). SPEC.md 5절의 "약 27일"이 이 값에서 나온다
const jump = applySeeds({ level: 1, exp: 0, evolutionStage: 1 }, 3000)
assert.equal(jump.level, EVOLUTION_LEVEL.STAGE4)
assert.equal(jump.exp, 0)
assert.equal(jump.evolvedTo, 4)

// 3단까지의 누적도 함께 못 박는다. 5 × 15 × 14 = 1,050개
const toStage3Total = applySeeds({ level: 1, exp: 0, evolutionStage: 1 }, 1050)
assert.equal(toStage3Total.level, EVOLUTION_LEVEL.STAGE3)
assert.equal(toStage3Total.exp, 0)
assert.equal(toStage3Total.evolvedTo, 3)

// stageCount가 1이면 진화하지 않는다. 지금 시드는 전부 4라(아래 스킨 검사) 쓰이지 않지만,
// 단계 수가 다른 스킨이 들어와도 저장값이 stageCount를 넘지 않는 것을 지키는 방어다
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

// ── 스킨 이름 어미 = 종족 동물명 (SPEC.md 5절) ────────────────────────────────
//
// 이미지가 안 뜰 때 원판·배지에 동물 이모지로 떨어진다. animalEmoji()는 이름의 **어미**로
// 기본 동물을 찾는다(북극여우 → 여우 → 🦊). 변종마다 이모지를 새로 적지 않으려고 그렇게 짰다.
//
// 이 규칙이 깨지는 방식이 조용하다. 어미가 종족명이 아닌 이름("스노우폭스")을 시드에 넣으면
// 예외가 나지 않고 발자국(🐾)이 뜬다. 빌드도 lint도 통과하고 화면만 이상해진다.
// 그래서 시드를 직접 읽어 못 박는다 — 이름을 바꾸면 npm run check:pet 이 먼저 걸린다.
//
// 이 검사는 DB를 읽지 않는다. prisma/seed/items.ts는 순수 데이터이고 @prisma/client를
// type으로만 import하므로 커넥션 없이 그대로 읽힌다.

assert.equal(PET_SKINS.length, 6) // 기본 3종 + 변종 3종

for (const skin of PET_SKINS) {
  const tribe = TRIBE[skin.typeCode]
  assert.ok(tribe, `${skin.name}: 모르는 typeCode ${skin.typeCode}`)

  // 어미가 종족의 동물명이어야 한다. 이게 animalEmoji()의 유일한 단서다
  assert.ok(
    skin.name.endsWith(tribe.animal),
    `${skin.name}: 이름 어미가 종족 동물명(${tribe.animal})이 아니다. ` +
      `animalEmoji()가 발자국을 돌려주고 화면에 조용히 🐾가 뜬다`,
  )

  // 어미로 찾은 이모지가 그 종족의 이모지와 같아야 한다.
  // 어미 규칙을 지켜도 TRIBE와 어긋나면(예: 곰 스킨을 여우 typeCode에 붙이면) 여기서 걸린다
  assert.equal(animalEmoji(skin.name), tribe.emoji, `${skin.name}: 이모지가 종족과 어긋난다`)

  // 외형만 바뀌므로 전부 4단 진화다. 기본 외형은 진단으로 지급되어 가격이 없고,
  // 변종은 별조각 전용이다(친밀도가 아니다 — 2026-08-20 확정)
  // S3에 종당 4장(`-1`~`-4`)이 있어 2026-08-21에 3 → 4로 올렸다. 단계 수를 바꾸면
  // 실 DB의 PetSkin 6행도 함께 올려야 한다 — 시드 파일만 고치면 화면은 3단에서 멈춘다
  assert.equal(skin.stageCount, 4, `${skin.name}: stageCount는 전부 4다`)
  if (skin.isDefault) {
    assert.equal(skin.name, tribe.animal, `${skin.name}: 기본 외형 이름은 동물명 그대로다`)
    assert.equal(skin.priceShards ?? null, null, `${skin.name}: 기본 외형은 살 수 없다`)
  } else {
    assert.ok(
      typeof skin.priceShards === "number" && skin.priceShards > 0,
      `${skin.name}: 변종은 priceShards가 있어야 상점에 뜬다`,
    )
  }
}

// 종족마다 기본 1종 + 변종 1종. 한쪽이 빠지면 그 종족은 상점이 비거나 펫이 없다
for (const code of Object.keys(TRIBE) as (keyof typeof TRIBE)[]) {
  const mine = PET_SKINS.filter((skin) => skin.typeCode === code)
  assert.equal(mine.filter((skin) => skin.isDefault).length, 1, `${code}: 기본 외형은 1종이다`)
  assert.equal(mine.filter((skin) => !skin.isDefault).length, 1, `${code}: 변종은 1종이다`)
}

// 변종 3종은 값이 같다. 종족마다 다르면 어느 종족으로 진단됐는지가 가격으로 드러난다
// (2026-08-20 확정: 별조각 2500. 수급은 일일 전체 완료 60 + 출석 25/7일 = 약 63.6/일)
for (const skin of PET_SKINS.filter((item) => !item.isDefault)) {
  assert.equal(skin.priceShards, 2500, `${skin.name}: 변종 스킨은 전부 별조각 2500이다`)
}

// 어미를 모르는 이름은 화면이 비지 않게 발자국으로 떨어진다 (예외를 던지지 않는다)
assert.equal(animalEmoji("스노우폭스"), "🐾")
assert.equal(animalEmoji(""), "🐾")

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

// ── 치장 구성 (2026-08-20: 12종 → 배경 6종) ───────────────────────────────────
// 시드가 조용히 늘거나 슬롯이 섞이면 여기서 걸린다. 화면은 슬롯별 카드로 그리므로
// 모자·목도리가 다시 들어오면 빈 카드가 아니라 새 카드가 생긴다 — 의도한 변경일 때만 이 값을 고친다.

// 2026-08-22: name이 표시명("배경1")에서 코드("autumn_path")로 바뀌었다.
// 코드는 DB의 유니크 upsert 키다 — 여기 값을 고치면 실 DB에 새 행이 생기고 옛 행이 남는다.
// 이름을 바꾸고 싶으면 코드가 아니라 BACKGROUNDS의 label을 고친다(lib/pet.ts 주석).
const BG_CODES = ["autumn_path", "forest_camp", "spring_garden", "aurora_field", "frozen_ocean", "winter_village"]

assert.deepEqual(
  COSMETICS.map((item) => item.name),
  BG_CODES,
)
// 시드는 BACKGROUNDS에서 파생된다. 두 곳에 손으로 적으면 갈라지므로 파생 자체를 못 박는다
assert.deepEqual(
  BACKGROUNDS.map((bg) => bg.code),
  BG_CODES,
)
assert.deepEqual(
  COSMETICS.map((item) => item.imageKey),
  BACKGROUNDS.map((bg) => bg.imageKey),
)

// 사용자가 정한 표시명 (2026-08-22). 순서는 계절 흐름이다: 가을 → 숲 → 봄 → 오로라 → 빙해 → 겨울
assert.deepEqual(BG_CODES.map(cosmeticLabel), [
  "노을빛 단풍길",
  "숲 속 캠프",
  "봄날의 정원",
  "오로라 들판",
  "푸른 빙해",
  "눈꽃 마을",
])
// 모르는 코드는 빈 칸이 아니라 그대로 보여야 한다 (옛 이름이 남은 DB·나중에 추가된 아이템)
assert.equal(cosmeticLabel("배경1"), "배경1")

// 실제 S3 키가 아닌 값이 들어오면 화면이 조용히 403 이미지가 된다.
// 키는 "우리가 정한 규칙"이 아니라 올라간 파일명이 정본이다(prisma/seed/items.ts 주석)
assert.ok(
  BACKGROUNDS.every((bg) => bg.imageKey.startsWith("backgrounds/") && bg.imageKey.endsWith(".png")),
  "배경 imageKey는 backgrounds/ 아래 .png다",
)
assert.equal(new Set(BACKGROUNDS.map((bg) => bg.imageKey)).size, BACKGROUNDS.length)
assert.equal(new Set(BACKGROUNDS.map((bg) => bg.label)).size, BACKGROUNDS.length)

assert.ok(
  COSMETICS.every((item) => item.slot === "BACKGROUND"),
  "치장은 배경 슬롯만 쓴다 (모자·목도리 컷)",
)
// 6종 전부 COMMON 600 = 합계 3600. 친밀도 일 상한 100이므로 배경 하나에 6일, 전부 36일이다
assert.ok(
  COSMETICS.every((item) => item.rarity === "COMMON"),
  "배경 6종은 등급을 가르지 않는다 (서로 대체재라 값 차이에 정보가 없다)",
)
assert.equal(PRICE_BY_RARITY.COMMON, 600)
assert.equal(PRICE_BY_RARITY.COMMON * COSMETICS.length, 3600)

// 등급이 올라갈수록 비싸야 한다. COMMON만 올리고 나머지를 두면 순서가 뒤집혀도
// 빌드·lint가 통과하고, 등급을 바꾼 사람은 값이 내려간 것을 모른다
const RARITY_LADDER = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const
for (let i = 1; i < RARITY_LADDER.length; i += 1) {
  assert.ok(
    PRICE_BY_RARITY[RARITY_LADDER[i]] > PRICE_BY_RARITY[RARITY_LADDER[i - 1]],
    `${RARITY_LADDER[i]}가 ${RARITY_LADDER[i - 1]}보다 싸다 — 등급 가격 순서가 뒤집혔다`,
  )
}

// ── 치장 목록 정렬 ────────────────────────────────────────────────────────────
// 화면과 API가 같은 함수를 쓴다. 순서가 바뀌면 여기서 걸린다

const cos = (name: string, slot: "HAT" | "SCARF" | "BACKGROUND", rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY") =>
  ({ name, slot, rarity }) as const

// 실제 시드 순서. 등급이 전부 같으므로 BACKGROUNDS의 진열 순서가 그대로 나와야 한다.
// 코드 가나다순으로 떨어지면(aurora_field가 맨 앞) 계절 흐름이 깨진 것이다
assert.deepEqual(
  [...COSMETICS].reverse().sort(compareCosmetics).map((item) => item.name),
  BG_CODES,
)

// 슬롯·등급 정렬은 지금 시드에 없는 조합까지 처리한다 (Slot enum·비교 함수는 3슬롯을 유지한다).
// 아래 아이템들은 실재하지 않는 가상 값이고, 비교 함수의 순서 규칙만 못 박는다
assert.deepEqual(
  [
    cos("가상 배경", "BACKGROUND", "COMMON"),
    cos("가상 목도리", "SCARF", "LEGENDARY"),
    cos("가상 목도리2", "SCARF", "COMMON"),
    cos("가상 모자", "HAT", "EPIC"),
    cos("가상 모자2", "HAT", "COMMON"),
  ]
    .sort(compareCosmetics)
    .map((item) => item.name),
  // 슬롯(모자 → 목도리 → 배경) → 등급(일반 → 희귀 → 영웅 → 전설) 순
  ["가상 모자2", "가상 모자", "가상 목도리2", "가상 목도리", "가상 배경"],
)

// 슬롯·등급이 같으면 이름 가나다순 (매 요청마다 순서가 흔들리지 않게)
assert.deepEqual(
  [cos("이끼 모자", "HAT", "EPIC"), cos("밤별 모자", "HAT", "EPIC")]
    .sort(compareCosmetics)
    .map((item) => item.name),
  ["밤별 모자", "이끼 모자"],
)

// ── 펫 대사 (2026-08-23) ──────────────────────────────────────────────────────
//
// 20문장은 **사용자가 직접 쓴 것**이다. 여기서 개수와 내용을 못 박는 이유는 문장이 조용히
// 다듬어지는 것을 막기 위해서다 — 오탈자로 보이는 표기("궁금해")까지 사용자 원문이고,
// 고치려면 사용자에게 확인해야 한다. 아래 단정이 그 확인 없이 바뀌는 것을 막는다.
//
// 이 기능은 하루에 세 번 모양이 바뀌었다(구간 3개 → 고정 한 줄 → 사용자 20문장).
// 여기 있던 구간 단정·`daysAway` 단정·미래 시각 단정·느낌표 금지는 그 과정에서 다 걷혔다 —
// 세는 값이 없으면 검증할 경계도 없고, 느낌표는 이제 사용자 문장의 목소리다.

// 개수. 한쪽만 늘면 화면에서 어느 쪽이 늘었는지 안 보인다
assert.equal(PET_GREETINGS.length, 10)
assert.equal(PET_IDLE_LINES.length, 10)

// 원문 그대로. 첫 문장·마지막 문장을 양쪽 다 못 박아 순서까지 고정한다
assert.equal(PET_GREETINGS[0], "왔네! 기다리고 있었어.")
assert.equal(PET_GREETINGS[9], "기다리다 보니까 네가 왔네. 오늘도 만나서 반가워!")
assert.equal(PET_IDLE_LINES[0], "오늘 하늘 봤어? 나는 못 봤지만 궁금해!")
assert.equal(PET_IDLE_LINES[9], "오늘 하루 중에 제일 기억에 남는 순간은 뭐였을까?")

// 20문장이 서로 다르다. 같은 문장이 두 번 들어가면 순환에서 연달아 보인다
assert.equal(new Set([...PET_GREETINGS, ...PET_IDLE_LINES]).size, 20)

// 빈 문장·앞뒤 공백이 없다. 말풍선이 빈 칸으로 뜨는 것을 막는다
for (const line of [...PET_GREETINGS, ...PET_IDLE_LINES]) {
  assert.ok(line.length > 0 && line === line.trim(), `대사에 빈 문장이나 앞뒤 공백이 있다: "${line}"`)
}

// 유일하게 남은 문구 규칙: **비운 일수를 문장에 넣지 않는다**(lib/pet.ts). "3일 만이네요"는
// 사실이지만 질책으로 읽힌다. 나중에 문장을 보태는 사람이 규칙을 모르고 넣으면 여기서 걸린다.
// 펫이 **나빠졌다**는 표현도 같이 막는다 — 기다림은 애정이고 악화는 처벌이다
const BANNED = ["일 만", "일째", "일 동안", "며칠", "그동안 안", "외로", "슬퍼", "슬펐", "아팠", "힘들었", "미안"]
for (const line of [...PET_GREETINGS, ...PET_IDLE_LINES]) {
  for (const word of BANNED) {
    assert.ok(
      !line.includes(word),
      `대사에 금지 표현 "${word}"가 있다 — lib/pet.ts 문구 규칙 참고: "${line}"`,
    )
  }
}

// 문구 고르기. 같은 입력에 같은 값이어야 한다 — 서버에서 고르므로 렌더마다 달라지면
// 하이드레이션에서 서버 HTML과 클라이언트 첫 렌더가 어긋난다
assert.equal(lineIndex("abc", 10), lineIndex("abc", 10))
assert.equal(greetingFor("abc"), greetingFor("abc"))
// 범위를 벗어나지 않는다. 빈 문자열·긴 문자열·유니코드가 들어와도 목록 안이다
for (const seed of ["", "a", "user-1-2026-08-23", "🐻", "x".repeat(500)]) {
  const i = lineIndex(seed, PET_GREETINGS.length)
  assert.ok(i >= 0 && i < PET_GREETINGS.length, `lineIndex("${seed}")가 범위를 벗어났다: ${i}`)
  assert.ok(PET_GREETINGS.includes(greetingFor(seed) as (typeof PET_GREETINGS)[number]))
}
// count가 0이면 나머지 연산이 NaN이 된다. 0을 돌려주는지 확인한다
assert.equal(lineIndex("abc", 0), 0)
// seed가 다르면 문장도 흩어진다. 10개 중 3종 이상 나오면 한 문장에 몰린 것이 아니다
const spread = new Set(
  Array.from({ length: 30 }, (_, i) => greetingFor(`user-${i}-2026-08-23`)),
)
assert.ok(spread.size >= 3, `인사가 ${spread.size}종만 나온다 — seed가 골고루 흩어지지 않는다`)

// ── 배고픔 ────────────────────────────────────────────────────────────────────
// 2026-08-21 사용자 결정으로 삭제했다. 여기 있던 단정 12개(24시간 선형 감쇠, 음수 방지,
// 미래 시각, 라벨 3구간)도 함께 걷었다. lib/pet.ts "배고픔 — 삭제" 주석 참고.

console.log("pet 체크 통과")
