import type { Prisma, PrismaClient } from "@prisma/client"

// 소유자: C. 펫·캐릭터 6종 + 치장 9종 + 친밀도 전용 치장 3종.
// 이미지는 아직 없다. imageKey는 아래 규칙으로 미리 고정했으니 같은 이름으로 S3에 올린다.
//   펫:   pets/{base}-{1|2|3}.png   (stageCount가 1이면 pets/{base}.png)
//   치장: cosmetics/{key}.png
//
// TypeCode ↔ 종족 매핑 (2026-08-19 팀 확인, A의 feat/diagnosis 기준):
//   HEALTH_EMOTION         = 개과   / 여우   / 노을 주황 #E8956A
//   INDEPENDENT_LOW_INCOME = 고양잇과 / 고양이 / 새벽 파랑 #6A95C8
//   FAMILY_LIVING          = 곰과   / 곰     / 이끼 초록 #7AAE82
// 출처는 A의 lib/types.ts TRIBE와 styles/tokens.css [data-tribe]다(둘이 일치함).
// 이 파일은 위 새 매핑을 따른다. 아래 값을 고칠 때 동물·컬러가 아니라
// TypeCode만 보고 고치면 조용히 틀린다. 반드시 동물·컬러 기준으로 맞춘다.
// 주의: main의 SPEC.md 2절 표와 lib/types.ts는 아직 옛 매핑 + 옛 컬러명(앰버/라벤더/
// 세이지)이다. A의 브랜치도 SPEC.md 2절은 안 고쳐져 있으니, 머지 후 SPEC 2절을
// 이 표로 맞춰야 한다(A 담당).
//
// 컬러명 변경 이력 (A의 58f86f2 Figma 팔레트):
//   앰버 오렌지 → 노을 주황 / 라벤더 퍼플 → 새벽 파랑 / 세이지 그린 → 이끼 초록
// 치장 9종 이름과 imageKey를 여기에 맞춰 바꿨다. 이미지가 아직 없어 imageKey도 함께 바꿨다.
//
// 경고: 아래 upsert는 name을 유니크 키로 쓴다. 시드를 이미 돌린 DB에서 name을 바꾸면
// 옛 이름 행이 갱신되지 않고 새 행이 추가된다. 이름 변경은 반드시 첫 db:seed 전에 끝낸다.

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
// tribeColor는 컬러 계열이다. 노을=개과=HEALTH_EMOTION, 새벽=고양잇과=INDEPENDENT_LOW_INCOME,
// 이끼=곰과=FAMILY_LIVING. 파일 상단 매핑 주석을 먼저 읽는다.
const SHOP_COSMETICS: Prisma.CosmeticItemCreateInput[] = [
  { name: "노을 모자", slot: "HAT", rarity: "COMMON", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/hat-sunset.png" },
  { name: "새벽 모자", slot: "HAT", rarity: "RARE", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/hat-dawn.png" },
  { name: "이끼 모자", slot: "HAT", rarity: "EPIC", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/hat-moss.png" },

  { name: "새벽 목도리", slot: "SCARF", rarity: "COMMON", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/scarf-dawn.png" },
  { name: "이끼 목도리", slot: "SCARF", rarity: "RARE", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/scarf-moss.png" },
  { name: "노을 목도리", slot: "SCARF", rarity: "LEGENDARY", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/scarf-sunset.png" },

  { name: "이끼 배경", slot: "BACKGROUND", rarity: "COMMON", tribeColor: "FAMILY_LIVING", imageKey: "cosmetics/bg-moss.png" },
  { name: "노을 배경", slot: "BACKGROUND", rarity: "RARE", tribeColor: "HEALTH_EMOTION", imageKey: "cosmetics/bg-sunset.png" },
  { name: "새벽 배경", slot: "BACKGROUND", rarity: "EPIC", tribeColor: "INDEPENDENT_LOW_INCOME", imageKey: "cosmetics/bg-dawn.png" },
]

// 친밀도 상점 전용 3종. affinityOnly=true로 구분한다.
// 밤별은 노을·새벽·이끼 3컬러 밖의 별도 색이고 유형 제한 없이 누구나 살 수 있다.
// tribeColor는 구매를 막지 않는 표시용 값이라 새벽 계열(고양잇과)로 두었다.
const AFFINITY_COSMETICS: Prisma.CosmeticItemCreateInput[] = [
  { name: "밤별 모자", slot: "HAT", rarity: "EPIC", tribeColor: "INDEPENDENT_LOW_INCOME", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/hat-night.png" },
  { name: "밤별 목도리", slot: "SCARF", rarity: "EPIC", tribeColor: "INDEPENDENT_LOW_INCOME", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/scarf-night.png" },
  { name: "밤별 배경", slot: "BACKGROUND", rarity: "EPIC", tribeColor: "INDEPENDENT_LOW_INCOME", affinityOnly: true, priceAffinity: 200, imageKey: "cosmetics/bg-night.png" },
]

// 2026-08-19: 옛 이름으로 이미 시드된 공유 DB를 되돌리기 위한 이름 이관 표.
// E가 옛 시드 파일로 db:seed를 먼저 돌려 앰버·라벤더·세이지 9종이 DB에 들어갔다.
// upsert 키가 name이라 이름만 바꾸면 새 행 9개가 생기고 옛 행 9개가 고아로 남는다.
// 그래서 upsert 전에 옛 이름 행을 새 이름으로 바꾼다. UserCosmetic FK는 id를
// 참조하므로 이름 변경은 안전하고, 지우는 것이 없어 되돌릴 것도 없다.
// 옛 행이 없으면(깨끗한 DB) 아무 일도 하지 않는다.
const RENAMED_COSMETICS: ReadonlyArray<readonly [string, string]> = [
  ["앰버 모자", "노을 모자"],
  ["앰버 목도리", "노을 목도리"],
  ["앰버 배경", "노을 배경"],
  ["라벤더 모자", "새벽 모자"],
  ["라벤더 목도리", "새벽 목도리"],
  ["라벤더 배경", "새벽 배경"],
  ["세이지 모자", "이끼 모자"],
  ["세이지 목도리", "이끼 목도리"],
  ["세이지 배경", "이끼 배경"],
]

/**
 * 옛 이름 행을 새 이름으로 바꾼다. 새 이름 행이 이미 있으면 건드리지 않고 남겨 둔다
 * (이름을 바꾸면 유니크 제약에 걸린다). 그 경우 사람이 판단해야 하므로 경고만 남긴다.
 */
async function renameLegacyCosmetics(prisma: PrismaClient) {
  const leftovers: string[] = []

  for (const [oldName, newName] of RENAMED_COSMETICS) {
    const legacy = await prisma.cosmeticItem.findUnique({ where: { name: oldName } })
    if (!legacy) continue

    const taken = await prisma.cosmeticItem.findUnique({ where: { name: newName } })
    if (taken) {
      leftovers.push(oldName)
      continue
    }

    await prisma.cosmeticItem.update({ where: { id: legacy.id }, data: { name: newName } })
    console.log(`  치장 이름 이관: ${oldName} → ${newName}`)
  }

  if (leftovers.length > 0) {
    console.warn(
      `  경고: 옛 이름 행 ${leftovers.length}개가 남았다 (새 이름 행이 이미 있어 이관 불가): ${leftovers.join(", ")}\n` +
        `  UserCosmetic이 참조하지 않는지 확인한 뒤 사람이 직접 지운다. 시드는 지우지 않는다.`,
    )
  }
}

export async function seedItems(prisma: PrismaClient) {
  // 펫 6종은 이름이 그대로라 upsert가 typeCode를 알아서 고친다.
  // (E가 옛 매핑으로 시드한 여우↔고양이·늑대↔삵도 여기서 교정된다)
  for (const skin of PET_SKINS) {
    await prisma.petSkin.upsert({ where: { name: skin.name }, update: skin, create: skin })
  }

  // 치장은 이름이 바뀌었으므로 upsert 전에 이관한다. 순서를 바꾸면 고아 행이 생긴다.
  await renameLegacyCosmetics(prisma)

  const cosmetics = [...SHOP_COSMETICS, ...AFFINITY_COSMETICS]
  for (const item of cosmetics) {
    await prisma.cosmeticItem.upsert({ where: { name: item.name }, update: item, create: item })
  }

  console.log(`펫·캐릭터 ${PET_SKINS.length}종, 치장 ${cosmetics.length}종 반영`)
}
