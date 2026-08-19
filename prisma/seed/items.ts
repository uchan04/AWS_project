import type { Prisma, PrismaClient } from "@prisma/client"

// 소유자: C. 펫·캐릭터 6종 + 치장 9종 + 친밀도 전용 치장 3종.
// 이미지는 아직 없다. imageKey는 아래 규칙으로 미리 고정했으니 같은 이름으로 S3에 올린다.
//   펫:   pets/{base}-{1|2|3}.png   (stageCount가 1이면 pets/{base}.png)
//   치장: cosmetics/{key}.png
//
// TypeCode ↔ 종족 매핑 (2026-08-19 팀 확인, A의 feat/diagnosis 기준):
//   HEALTH_EMOTION         = 개과   / 여우   / 앰버 오렌지
//   INDEPENDENT_LOW_INCOME = 고양잇과 / 고양이 / 라벤더 퍼플
//   FAMILY_LIVING          = 곰과   / 곰     / 세이지 그린
// 이 파일은 위 새 매핑을 따른다. 아래 값을 고칠 때 동물·컬러가 아니라
// TypeCode만 보고 고치면 조용히 틀린다. 반드시 동물·컬러 기준으로 맞춘다.
// 주의: main의 SPEC.md 2절 표와 lib/types.ts는 아직 옛 매핑이다. A 브랜치가
// 머지되면 일치한다. 머지 전에는 이 파일만 새 매핑이라는 점을 알고 봐야 한다.

const PET_SKINS: Prisma.PetSkinCreateInput[] = [
  // 기본 펫 3종. 진화 3단, 보너스 없음, 구매 불가
  {
    name: "여우", // 개과
    typeCode: "HEALTH_EMOTION",
    isDefault: true,
    stageCount: 3,
    imageKeyBase: "pets/fox",
  },
  {
    name: "고양이", // 고양잇과
    typeCode: "INDEPENDENT_LOW_INCOME",
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
    name: "늑대", // 개과
    typeCode: "HEALTH_EMOTION",
    stageCount: 1,
    effectType: "SEED",
    effectPct: 15,
    priceAffinity: 300,
    imageKeyBase: "pets/wolf",
  },
  {
    name: "삵", // 고양잇과
    typeCode: "INDEPENDENT_LOW_INCOME",
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

// 치장 9종. 획득 경로는 미정 (가챠 제거로 경로가 사라졌다. docs/dev/pet.md 참고)
// tribeColor는 컬러 계열이다. 앰버=개과=HEALTH_EMOTION, 라벤더=고양잇과=INDEPENDENT_LOW_INCOME,
// 세이지=곰과=FAMILY_LIVING. 파일 상단 매핑 주석을 먼저 읽는다.
const SHOP_COSMETICS: Prisma.CosmeticItemCreateInput[] = [
  { name: "앰버 모자", slot: "HAT", rarity: "COMMON", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/hat-amber.png" },
  { name: "라벤더 모자", slot: "HAT", rarity: "RARE", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/hat-lavender.png" },
  { name: "세이지 모자", slot: "HAT", rarity: "EPIC", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/hat-sage.png" },

  { name: "라벤더 목도리", slot: "SCARF", rarity: "COMMON", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/scarf-lavender.png" },
  { name: "세이지 목도리", slot: "SCARF", rarity: "RARE", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/scarf-sage.png" },
  { name: "앰버 목도리", slot: "SCARF", rarity: "LEGENDARY", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/scarf-amber.png" },

  { name: "세이지 배경", slot: "BACKGROUND", rarity: "COMMON", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/bg-sage.png" },
  { name: "앰버 배경", slot: "BACKGROUND", rarity: "RARE", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/bg-amber.png" },
  { name: "라벤더 배경", slot: "BACKGROUND", rarity: "EPIC", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/bg-lavender.png" },
]

// 친밀도 상점 전용 3종. affinityOnly=true로 구분한다.
// 밤별은 앰버·라벤더·세이지 3컬러 밖의 별도 색이고 유형 제한 없이 누구나 살 수 있다.
// tribeColor는 구매를 막지 않는 표시용 값이라 라벤더 계열(고양잇과)로 두었다.
const AFFINITY_COSMETICS: Prisma.CosmeticItemCreateInput[] = [
  { name: "밤별 모자", slot: "HAT", rarity: "EPIC", tribeColor: "INDEPENDENT_LOW_INCOME", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/hat-night.png" },
  { name: "밤별 목도리", slot: "SCARF", rarity: "EPIC", tribeColor: "INDEPENDENT_LOW_INCOME", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/scarf-night.png" },
  { name: "밤별 배경", slot: "BACKGROUND", rarity: "EPIC", tribeColor: "INDEPENDENT_LOW_INCOME", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/bg-night.png" },
]

export async function seedItems(prisma: PrismaClient) {
  for (const skin of PET_SKINS) {
    await prisma.petSkin.upsert({ where: { name: skin.name }, update: skin, create: skin })
  }

  const cosmetics = [...SHOP_COSMETICS, ...AFFINITY_COSMETICS]
  for (const item of cosmetics) {
    await prisma.cosmeticItem.upsert({ where: { name: item.name }, update: item, create: item })
  }

  console.log(`펫·캐릭터 ${PET_SKINS.length}종, 치장 ${cosmetics.length}종 반영`)
}
