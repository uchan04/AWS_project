import type { Prisma, PrismaClient } from "@prisma/client"

// 소유자: C. 펫·캐릭터 6종 + 가챠 치장 9종 + 친밀도 전용 치장 3종.
// 이미지는 아직 없다. imageKey는 아래 규칙으로 미리 고정했으니 같은 이름으로 S3에 올린다.
//   펫:   pets/{base}-{1|2|3}.png   (stageCount가 1이면 pets/{base}.png)
//   치장: cosmetics/{key}.png

const PET_SKINS: Prisma.PetSkinCreateInput[] = [
  // 기본 펫 3종. 진화 3단, 보너스 없음, 구매 불가
  {
    name: "여우",
    typeCode: "INDEPENDENT_LOW_INCOME",
    isDefault: true,
    stageCount: 3,
    imageKeyBase: "pets/fox",
  },
  {
    name: "고양이",
    typeCode: "HEALTH_EMOTION",
    isDefault: true,
    stageCount: 3,
    imageKeyBase: "pets/cat",
  },
  {
    name: "곰",
    typeCode: "FAMILY_LIVING",
    isDefault: true,
    stageCount: 3,
    imageKeyBase: "pets/bear",
  },

  // 친밀도 전용 캐릭터 3종. 단일 형태, 각 300 친밀도, 유형 제한 없이 누구나 구매 가능
  {
    name: "늑대",
    typeCode: "INDEPENDENT_LOW_INCOME",
    stageCount: 1,
    effectType: "SEED",
    effectPct: 15,
    priceAffinity: 300,
    imageKeyBase: "pets/wolf",
  },
  {
    name: "삵",
    typeCode: "HEALTH_EMOTION",
    stageCount: 1,
    effectType: "SHARD",
    effectPct: 10,
    priceAffinity: 300,
    imageKeyBase: "pets/leopardcat",
  },
  {
    name: "판다",
    typeCode: "FAMILY_LIVING",
    stageCount: 1,
    effectType: "AFFINITY",
    effectPct: 20,
    priceAffinity: 300,
    imageKeyBase: "pets/panda",
  },
]

// 가챠 풀 9종. 등급 분포는 일반 3 / 희귀 3 / 영웅 2 / 전설 1 (SPEC.md 5절).
// 컬러는 tribeColor로 표현한다. AMBER=개과, LAVENDER=고양잇과, SAGE=곰과
const GACHA_COSMETICS: Prisma.CosmeticItemCreateInput[] = [
  { name: "앰버 모자", slot: "HAT", rarity: "COMMON", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/hat-amber.png" },
  { name: "라벤더 모자", slot: "HAT", rarity: "RARE", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/hat-lavender.png" },
  { name: "세이지 모자", slot: "HAT", rarity: "EPIC", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/hat-sage.png" },

  { name: "라벤더 목도리", slot: "SCARF", rarity: "COMMON", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/scarf-lavender.png" },
  { name: "세이지 목도리", slot: "SCARF", rarity: "RARE", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/scarf-sage.png" },
  { name: "앰버 목도리", slot: "SCARF", rarity: "LEGENDARY", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/scarf-amber.png" },

  { name: "세이지 배경", slot: "BACKGROUND", rarity: "COMMON", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/bg-sage.png" },
  { name: "앰버 배경", slot: "BACKGROUND", rarity: "RARE", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/bg-amber.png" },
  { name: "라벤더 배경", slot: "BACKGROUND", rarity: "EPIC", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/bg-lavender.png" },
]

// 친밀도 상점 전용 3종. affinityOnly=true이므로 가챠 추첨 풀에서 반드시 제외한다.
const AFFINITY_COSMETICS: Prisma.CosmeticItemCreateInput[] = [
  { name: "밤별 모자", slot: "HAT", rarity: "EPIC", tribeColor: "HEALTH_EMOTION", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/hat-night.png" },
  { name: "밤별 목도리", slot: "SCARF", rarity: "EPIC", tribeColor: "HEALTH_EMOTION", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/scarf-night.png" },
  { name: "밤별 배경", slot: "BACKGROUND", rarity: "EPIC", tribeColor: "HEALTH_EMOTION", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/bg-night.png" },
]

export async function seedItems(prisma: PrismaClient) {
  for (const skin of PET_SKINS) {
    await prisma.petSkin.upsert({ where: { name: skin.name }, update: skin, create: skin })
  }

  const cosmetics = [...GACHA_COSMETICS, ...AFFINITY_COSMETICS]
  for (const item of cosmetics) {
    await prisma.cosmeticItem.upsert({ where: { name: item.name }, update: item, create: item })
  }

  console.log(`펫·캐릭터 ${PET_SKINS.length}종, 치장 ${cosmetics.length}종 반영`)
}
