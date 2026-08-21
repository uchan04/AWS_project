import type { Prisma, PrismaClient, Rarity } from "@prisma/client"

// 소유자: C. 종족 외형 스킨 6종 + 치장(배경) 6종.
// 이미지는 아직 없다. imageKey는 아래 규칙으로 미리 고정했으니 같은 이름으로 S3에 올린다.
//   펫:   pets/{base}-{1|2|3}.png
//   치장: cosmetics/{key}.png
//
// TypeCode ↔ 종족 매핑 (2026-08-19 팀 확인, A의 feat/diagnosis 기준):
//   HEALTH_EMOTION         = 개과   / 여우   / 노을 주황 #E8956A
//   INDEPENDENT_LOW_INCOME = 고양잇과 / 고양이 / 새벽 파랑 #6A95C8
//   FAMILY_LIVING          = 곰과   / 곰     / 이끼 초록 #7AAE82
// 출처는 A의 lib/types.ts TRIBE와 styles/tokens.css [data-tribe]다(둘이 일치함).
// 이 파일은 위 새 매핑을 따른다. 아래 값을 고칠 때 동물·컬러가 아니라
// TypeCode만 보고 고치면 조용히 틀린다. 반드시 동물·컬러 기준으로 맞춘다.
// 주의: SPEC.md 2절 표는 아직 옛 매핑이다. 머지 후 이 표로 맞춰야 한다(A 담당).
//
// 경고: 아래 upsert는 name을 유니크 키로 쓴다. 시드를 이미 돌린 DB에서 name을 바꾸면
// 옛 이름 행이 갱신되지 않고 새 행이 추가된다. 스킨(PetSkin) 이름 변경은 반드시 첫 db:seed
// 전에 끝낸다 — 스킨에는 정리 코드가 없다.
// 치장은 pruneCosmetics()가 목록에서 빠진 행을 지우므로 이름을 바꿔도 옛 행이 남지 않는다
// (보유자가 있는 행은 예외. 그 함수 주석 참고).

// 스킨은 진단으로 정해진 종족 안에서만 고른다. 어미가 종족명이면 같은 종족이고,
// 그룹핑은 typeCode가 담당한다(어미 문자열은 scripts/check-pet.ts에서 단정만 한다).
// 능력치는 바뀌지 않고 외형만 바뀌므로 effectType은 전부 NONE이고 stageCount는 전부 4다.
//
// 2026-08-21: stageCount를 3 → 4로 올렸다. S3에 종당 4장(`-1`~`-4`)이 올라와 있고
// 4단 진화가 계획된 것임을 E가 확인해 줬다. 임계값은 lib/types.ts의 EVOLUTION_LEVEL이 정본이다.
// !! 실 DB의 PetSkin 6행은 아직 stageCount = 3이다. 시드 재실행(npm run db:seed)이나
// UPDATE로 4로 올려야 4단 이미지가 화면에 뜬다 — 사용자 승인 후 실행한다 !!
// 구매 화폐는 별조각 전용이다. 가격 2500은 2026-08-20 팀 확정값이다(그 전 안은 300, 최초 안은 50).
//
// 이 값은 같은 날 확정된 수급량과 짝이다: 일일 미션 전체 완료 = 별조각 60.
// 수급 = 60/일 + 출석 4·7일차 25(7일 주기 = 약 3.6/일) = 약 63.6/일이므로 2500은 약 39일이다.
// 치장 6종 합계 3600 친밀도(상한 100/일 = 36일)와 비슷한 속도로 맞췄다.
//
// !! 일일 전체 완료 60은 아직 구현되지 않았다 (lib/missions/completion.ts:128 TODO, B 담당) !!
// 그게 없으면 수급이 출석 3.6/일뿐이라 2500은 약 700일이다. B가 넣기 전에는 상점이 사실상 잠긴다.
//
// 실 DB 반영 완료 (2026-08-20). 이제 시드 파일과 실 DB가 일치한다 — 어긋나게 두지 않는다.
// 8/26 녹화용 데모 계정은 별조각을 시드로 넣는다(39일은 실제로 모을 수 있는 기간이 아니다.
// 업무분담.md 5장).
const VARIANT_PRICE_SHARDS = 2500

// scripts/check-pet.ts가 "이름 어미 = 종족 동물명"을 단정하려고 이 배열을 읽는다.
// 이 파일은 런타임 import가 없고(@prisma/client는 type import뿐이다) 순수 데이터라
// 체크 스크립트가 DB 없이 그대로 읽을 수 있다.
export const PET_SKINS: Prisma.PetSkinCreateInput[] = [
  // 개과 — 건강·정서취약형
  { name: "여우", typeCode: "HEALTH_EMOTION", isDefault: true, stageCount: 4, imageKeyBase: "pets/fox" },
  {
    name: "북극여우",
    typeCode: "HEALTH_EMOTION",
    stageCount: 4,
    priceShards: VARIANT_PRICE_SHARDS,
    imageKeyBase: "pets/fox-arctic",
  },

  // 고양잇과 — 독립거주-저소득형
  { name: "고양이", typeCode: "INDEPENDENT_LOW_INCOME", isDefault: true, stageCount: 4, imageKeyBase: "pets/cat" },
  {
    // 2026-08-20: 샴고양이 → 북극고양이로 개명. 북극여우·북극곰과 어휘를 맞췄다.
    // 실 DB는 시드 재실행이 아니라 UPDATE로 제자리 변경했다(위 17~19줄 경고 참고) —
    // 시드를 다시 돌려도 옛 행이 남지 않는다. imageKeyBase도 같이 바꿨다.
    // 이미지가 아직 없어서 지금은 공짜지만, 올린 뒤에 바꾸면 S3 키가 어긋난다.
    name: "북극고양이",
    typeCode: "INDEPENDENT_LOW_INCOME",
    stageCount: 4,
    priceShards: VARIANT_PRICE_SHARDS,
    imageKeyBase: "pets/cat-arctic",
  },

  // 곰과 — 가족동거형
  { name: "곰", typeCode: "FAMILY_LIVING", isDefault: true, stageCount: 4, imageKeyBase: "pets/bear" },
  {
    // 2026-08-21: imageKeyBase를 pets/bear-polar → pets/bear-arctic으로 고쳤다(차단 19번).
    // S3 실제 파일명이 bear-arctic이고 -polar는 403이다. 여우·고양이도 -arctic이라
    // 어휘가 맞는 쪽이다. 실 DB도 같이 UPDATE했다(이름은 그대로라 upsert가 덮어쓴다).
    name: "북극곰",
    typeCode: "FAMILY_LIVING",
    stageCount: 4,
    priceShards: VARIANT_PRICE_SHARDS,
    imageKeyBase: "pets/bear-arctic",
  },
]

// 치장 6종. 종족 구분이 없어 누구나 쓸 수 있고, 전부 친밀도 전용이다.
// 등급은 추첨 확률이 아니라 가격 기준으로 쓴다 (2026-08-20 팀 확정값).
//
// 아이템을 추가할 때 가격을 손으로 적지 않는다. 등급만 정하면 아래 표에서 파생된다
// (seedItems의 upsert가 priceAffinity를 매번 이 표로 덮어쓴다). 등급을 새로 만들려면
// schema.prisma의 Rarity enum을 먼저 늘려야 하고, 그건 전원 합의 사항이다.
// scripts/check-pet.ts가 합계(600 × 6 = 3600)를 단정하려고 이 표를 읽는다.
//
// COMMON 600은 2026-08-20 팀 확정값이다(그 전 값은 60). RARE 이상도 함께 10배로 올렸다 —
// COMMON만 올리면 RARE(100)가 COMMON(600)보다 싸져서 등급 순서가 뒤집힌다. 지금 치장 6종은
// 전부 COMMON이라 RARE 이상은 쓰이지 않지만, 값이 뒤집힌 표를 남겨 두면 다음 사람이 등급만
// 바꿨을 때 가격이 조용히 내려간다.
export const PRICE_BY_RARITY: Record<Rarity, number> = { COMMON: 600, RARE: 1000, EPIC: 1800, LEGENDARY: 2800 }

type CosmeticSeed = Omit<Prisma.CosmeticItemCreateInput, "affinityOnly" | "priceAffinity">

// 2026-08-20 변경: 모자·목도리를 컷하고 배경 6종만 남겼다 (이전 12종 = 모자·목도리·배경 각 4개).
// 이미지를 12장 만들 시간이 없고, 슬롯이 하나면 "슬롯당 1개" 규칙이 곧 "배경 하나 고르기"가
// 되어 화면도 단순해진다. Slot enum의 HAT·SCARF는 스키마에 그대로 둔다 — 시드에서 안 쓰면
// 행이 생기지 않으므로 마이그레이션이 필요 없다(schema.prisma는 전원 합의 파일이다).
//
// 등급은 6종 전부 COMMON이다. 합계 3600 친밀도이고 친밀도 일 상한이 100이므로(SPEC.md 5절)
// 배경 하나에 6일, 전부 모으는 데 최소 36일이다. 배경끼리 값 차이를 두면 "비싼 배경"이
// 생기는데, 6종이 서로 대체재라 등급을 갈라도 유저가 얻는 정보가 없다.
// 값을 다시 갈라야 하면 rarity만 바꾼다 — 가격은 PRICE_BY_RARITY에서 따라온다.
//
// 36일은 8/26 녹화까지 실제로 모을 수 있는 기간이 아니다. 데모 계정에 친밀도와 보유 배경을
// 시드로 넣어 수집 진행률이 채워진 화면을 찍는다(업무분담.md 5장).
//
// scripts/check-pet.ts가 위 구성(6종·전부 BACKGROUND·이름 배경1~6)을 단정한다.
export const COSMETICS: CosmeticSeed[] = [
  { name: "배경1", slot: "BACKGROUND", rarity: "COMMON", imageKey: "cosmetics/bg-1.png" },
  { name: "배경2", slot: "BACKGROUND", rarity: "COMMON", imageKey: "cosmetics/bg-2.png" },
  { name: "배경3", slot: "BACKGROUND", rarity: "COMMON", imageKey: "cosmetics/bg-3.png" },
  { name: "배경4", slot: "BACKGROUND", rarity: "COMMON", imageKey: "cosmetics/bg-4.png" },
  { name: "배경5", slot: "BACKGROUND", rarity: "COMMON", imageKey: "cosmetics/bg-5.png" },
  { name: "배경6", slot: "BACKGROUND", rarity: "COMMON", imageKey: "cosmetics/bg-6.png" },
]

export async function seedItems(prisma: PrismaClient) {
  // 스킨 6종은 이름이 그대로라 upsert가 typeCode를 알아서 고친다.
  for (const skin of PET_SKINS) {
    await prisma.petSkin.upsert({ where: { name: skin.name }, update: skin, create: skin })
  }

  await pruneCosmetics(prisma)

  for (const item of COSMETICS) {
    // 가격은 등급에서 파생시킨다. 손으로 하나씩 적으면 등급과 값이 갈라진다.
    const data: Prisma.CosmeticItemCreateInput = {
      ...item,
      affinityOnly: true,
      priceAffinity: PRICE_BY_RARITY[item.rarity as Rarity],
    }
    await prisma.cosmeticItem.upsert({ where: { name: item.name }, update: data, create: data })
  }

  console.log(`스킨 ${PET_SKINS.length}종, 치장 ${COSMETICS.length}종 반영`)
}

// 시드 목록에서 빠진 치장을 지운다. 12종 → 배경 6종으로 줄이면서 필요해졌다.
// upsert는 name이 유니크 키라 새 6행을 만들 뿐이고 옛 12행은 그대로 남는다 — 그러면
// 화면에 18종이 뜬다(목록도 수집 진행률 분모도 CosmeticItem 행 수에서 나온다).
//
// 보유자가 있는 행은 지우지 않는다. UserCosmetic FK가 걸려 deleteMany가 터지고,
// 남의 보유 이력을 시드가 조용히 날리면 되돌릴 수 없다. 그 경우는 경고만 남기고
// 사람이 판단한다 — 시드는 유저 데이터를 지우지 않는다.
//
// 깨끗한 DB에서도, 이미 6종만 있는 DB에서도 아무 일도 하지 않는다(멱등).
async function pruneCosmetics(prisma: PrismaClient) {
  const stale = await prisma.cosmeticItem.findMany({
    where: { name: { notIn: COSMETICS.map((item) => item.name) } },
    select: { id: true, name: true, _count: { select: { owners: true } } },
  })
  if (stale.length === 0) return

  const removable = stale.filter((row) => row._count.owners === 0)
  const owned = stale.filter((row) => row._count.owners > 0)

  if (removable.length > 0) {
    await prisma.cosmeticItem.deleteMany({ where: { id: { in: removable.map((row) => row.id) } } })
    console.log(`옛 치장 ${removable.length}종 삭제: ${removable.map((row) => row.name).join(", ")}`)
  }

  if (owned.length > 0) {
    console.warn(
      `경고: 보유자가 있어 남긴 옛 치장 ${owned.length}종 — ${owned.map((row) => row.name).join(", ")}. ` +
        "화면에는 목록에 계속 보인다. 지울지 유지할지 팀에서 정한다",
    )
  }
}
