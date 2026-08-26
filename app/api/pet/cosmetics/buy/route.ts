import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { cosmeticLabel } from "@/lib/pet"
import { prisma } from "@/lib/prisma"

// 소유자: C. 별조각 전용 치장 구매. (SPEC.md 5절)
//
// **2026-08-25: 친밀도 → 별조각으로 전환했다(사용자 결정).** 치장·스킨 두 상점이 같은
// 재화를 받고, 친밀도의 소모처는 펫 외출 하나가 된다. 전환 전 잔액은 그대로 남으므로
// 화면이 "친밀도는 이제 외출에 쓴다"를 한 줄로 알린다(CosmeticList.tsx).
//
// 가격은 등급에서 파생된다. 유일한 출처는 prisma/seed/items.ts의 PRICE_BY_RARITY이고
// 여기서 숫자를 다시 적지 않는다 — 적으면 확정값이 바뀔 때 한쪽만 고쳐진다.
// 값은 DB의 priceShards에서만 읽는다. 여기에 숫자를 박으면 시드와 갈라진다.
//
// 스킨 구매(POST /api/pet/skins/buy)와 다른 점 하나: **종족 검사가 없다.** 치장은 종족
// 구분이 없어 누구나 산다(tribeColor 삭제). 차감하는 재화는 이제 둘 다 starShards다.
//
// calculateReward()를 통과하지 않는다. 저 함수는 재화를 "획득"할 때 배율을 얹는다.
// 여기는 별조각을 쓰는 쪽이라 배율을 얹으면 500을 내야 하는데 575가 빠진다.
// (/api/pet/feed, /api/pet/skins/buy, 외출 보내기와 같은 이유)
//
// 구매만 한다. 착용은 POST /api/pet/cosmetics 가 따로 한다 — 산 것을 바로 입히지 않는
// 유저도 있고, 슬롯당 1개 규칙 때문에 사는 순간 남이 벗겨지면 되돌릴 수 없다.

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_BODY", "요청 형식이 잘못되었습니다")
    }

    const itemId = (body as { itemId?: unknown })?.itemId
    if (typeof itemId !== "string" || itemId.length === 0) {
      return fail("INVALID_ITEM", "구매할 치장을 지정해 주세요")
    }

    const item = await prisma.cosmeticItem.findUnique({ where: { id: itemId } })
    if (!item) return fail("ITEM_NOT_FOUND", "없는 치장입니다", 404)

    // 판매 대상인지 확인한다. 시드가 채우지만, 나중에 비매품(이벤트 지급 등)이 생기면
    // priceShards가 null인 행이 들어온다. 그때 0원 구매가 되지 않게 막는다.
    // affinityOnly는 보지 않는다 — 2026-08-25 전환으로 죽은 값이다(schema.prisma 주석)
    if (item.priceShards === null) {
      return fail("NOT_FOR_SALE", "구매할 수 없는 치장입니다")
    }
    const price = item.priceShards

    const result = await prisma.$transaction(async (tx) => {
      // 이미 가진 것을 또 사면 별조각만 빠진다. @@unique([userId, itemId])가 잡아 주지만
      // 그건 500이 되므로 먼저 확인해 400으로 돌려준다
      const already = await tx.userCosmetic.findUnique({
        where: { userId_itemId: { userId: user.id, itemId: item.id } },
      })
      if (already) return { code: "ALREADY_OWNED" as const }

      // 연타로 두 요청이 겹치면 잔액보다 많이 빠질 수 있어 조건부 UPDATE로 깎는다.
      // starShards >= price 를 where에 넣으면 두 번째 요청은 count 0이 된다
      const paid = await tx.user.updateMany({
        where: { id: user.id, starShards: { gte: price } },
        data: { starShards: { decrement: price } },
      })
      if (paid.count !== 1) return { code: "NOT_ENOUGH_SHARDS" as const }

      // equipped는 기본값 false다. 사는 것과 입는 것을 섞지 않는다
      await tx.userCosmetic.create({ data: { userId: user.id, itemId: item.id } })

      const [after, owned] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { starShards: true } }),
        tx.userCosmetic.count({ where: { userId: user.id } }),
      ])

      return { code: "OK" as const, starShards: after.starShards, owned }
    })

    if (result.code === "ALREADY_OWNED") {
      return fail("ALREADY_OWNED", "이미 가지고 있는 치장입니다")
    }
    if (result.code === "NOT_ENOUGH_SHARDS") {
      // 스킨 구매(POST /api/pet/skins/buy)와 같은 코드·같은 문장을 쓴다. 두 상점이 같은
      // 재화를 받게 됐으므로 부족할 때 화면에 뜨는 말도 같아야 한다
      return fail("NOT_ENOUGH_SHARDS", `별조각이 부족합니다 (${price} 필요)`)
    }

    // 수집 진행률의 분자가 늘었으므로 같이 돌려준다. 화면이 진행률 바를 다시 그린다.
    // name은 DB에 코드로 들어 있어(2026-08-22) 표시명으로 바꿔 내린다 —
    // 구매 완료 문구에 그대로 쓰이는 값이라 코드가 새면 "autumn_path 구매 완료"가 된다
    return ok({
      itemId: item.id,
      name: cosmeticLabel(item.name),
      starShards: result.starShards,
      owned: result.owned,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[POST /api/pet/cosmetics/buy]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
