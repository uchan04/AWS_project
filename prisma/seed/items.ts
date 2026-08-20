import type { Prisma, PrismaClient, Rarity } from "@prisma/client"

// 소유자: C. 종족 외형 스킨 6종 + 치장 12종.
// 이미지는 아직 없다. imageKey는 아래 규칙으로 미리 고정했으니 같은 이름으로 S3에 올린다.
//   펫:   pets/{base}-{1|2|3}.png
//   치장: cosmetics/{key}.png

// 스킨은 진단으로 정해진 종족 안에서만 고른다. 어미가 종족명이면 같은 종족이고,
// 그룹핑은 typeCode가 담당한다(어미 문자열은 scripts/check-pet.ts에서 단정만 한다).
// 능력치는 바뀌지 않고 외형만 바뀌므로 effectType은 전부 NONE이고 stageCount는 전부 3이다.
// 구매 화폐는 별조각 전용이다.
const VARIANT_PRICE_SHARDS = 50

const PET_SKINS: Prisma.PetSkinCreateInput[] = [
  // 개과 — 건강·정서취약형
  { name: "여우", typeCode: "HEALTH_EMOTION", isDefault: true, stageCount: 3, imageKeyBase: "pets/fox" },
  {
    name: "북극여우",
    typeCode: "HEALTH_EMOTION",
    stageCount: 3,
    priceShards: VARIANT_PRICE_SHARDS,
    imageKeyBase: "pets/fox-arctic",
  },

  // 고양잇과 — 독립거주-저소득형
  { name: "고양이", typeCode: "INDEPENDENT_LOW_INCOME", isDefault: true, stageCount: 3, imageKeyBase: "pets/cat" },
  {
    name: "샴고양이",
    typeCode: "INDEPENDENT_LOW_INCOME",
    stageCount: 3,
    priceShards: VARIANT_PRICE_SHARDS,
    imageKeyBase: "pets/cat-siamese",
  },

  // 곰과 — 가족동거형
  { name: "곰", typeCode: "FAMILY_LIVING", isDefault: true, stageCount: 3, imageKeyBase: "pets/bear" },
  {
    name: "북극곰",
    typeCode: "FAMILY_LIVING",
    stageCount: 3,
    priceShards: VARIANT_PRICE_SHARDS,
    imageKeyBase: "pets/bear-polar",
  },
]

// 치장 12종. 종족 구분이 없어 누구나 쓸 수 있고, 전부 친밀도 전용이다.
// 등급은 추첨 확률이 아니라 가격 기준으로 쓴다. 12종 합 1,850 친밀도이며
// 친밀도는 하루 최대 100까지만 지급되므로(SPEC.md 5절) 약 19일 분량이다.
const PRICE_BY_RARITY: Record<Rarity, number> = { COMMON: 50, RARE: 100, EPIC: 200, LEGENDARY: 400 }

type CosmeticSeed = Omit<Prisma.CosmeticItemCreateInput, "affinityOnly" | "priceAffinity">

// 컬러명은 더 이상 종족과 대응하지 않는다(tribeColor 삭제). 노을·새벽·이끼는 색 이름일 뿐이다.
const COSMETICS: CosmeticSeed[] = [
  { name: "노을 모자", slot: "HAT", rarity: "COMMON", imageKey: "cosmetics/hat-sunset.png" },
  { name: "새벽 모자", slot: "HAT", rarity: "RARE", imageKey: "cosmetics/hat-dawn.png" },
  { name: "이끼 모자", slot: "HAT", rarity: "EPIC", imageKey: "cosmetics/hat-moss.png" },

  { name: "새벽 목도리", slot: "SCARF", rarity: "COMMON", imageKey: "cosmetics/scarf-dawn.png" },
  { name: "이끼 목도리", slot: "SCARF", rarity: "RARE", imageKey: "cosmetics/scarf-moss.png" },
  { name: "노을 목도리", slot: "SCARF", rarity: "LEGENDARY", imageKey: "cosmetics/scarf-sunset.png" },

  { name: "이끼 배경", slot: "BACKGROUND", rarity: "COMMON", imageKey: "cosmetics/bg-moss.png" },
  { name: "노을 배경", slot: "BACKGROUND", rarity: "RARE", imageKey: "cosmetics/bg-sunset.png" },
  { name: "새벽 배경", slot: "BACKGROUND", rarity: "EPIC", imageKey: "cosmetics/bg-dawn.png" },

  // 밤별은 위 3색 밖의 별도 색이다.
  { name: "밤별 모자", slot: "HAT", rarity: "EPIC", imageKey: "cosmetics/hat-night.png" },
  { name: "밤별 목도리", slot: "SCARF", rarity: "EPIC", imageKey: "cosmetics/scarf-night.png" },
  { name: "밤별 배경", slot: "BACKGROUND", rarity: "EPIC", imageKey: "cosmetics/bg-night.png" },
]

export async function seedItems(prisma: PrismaClient) {
  for (const skin of PET_SKINS) {
    await prisma.petSkin.upsert({ where: { name: skin.name }, update: skin, create: skin })
  }

  for (const item of COSMETICS) {
    // 가격은 등급에서 파생시킨다. 손으로 12개를 적으면 등급과 값이 갈라진다.
    const data: Prisma.CosmeticItemCreateInput = {
      ...item,
      affinityOnly: true,
      priceAffinity: PRICE_BY_RARITY[item.rarity as Rarity],
    }
    await prisma.cosmeticItem.upsert({ where: { name: item.name }, update: data, create: data })
  }

  console.log(`스킨 ${PET_SKINS.length}종, 치장 ${COSMETICS.length}종 반영`)
}
