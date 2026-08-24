import { fail, ok } from "@/lib/api"
import { cdnUrl } from "@/lib/assets"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { compareCosmetics, cosmeticLabel } from "@/lib/pet"
import { prisma } from "@/lib/prisma"

// 소유자: C. 치장 목록 조회 + 착용·해제. (SPEC.md 5절)
//
//   GET  — 전체 치장 목록 + 보유·착용 여부 + 수집 진행률
//   POST — { itemId, equipped } 로 착용·해제. 슬롯당 1개만 착용된다
//
// 재화가 오가지 않으므로 calculateReward()와 무관하다. 구매는 이 라우트가 하지 않는다 —
// POST /api/pet/cosmetics/buy 가 따로 한다. 치장은 친밀도 전용 상점에서 등급 가격으로 산다
// (2026-08-20 확정). 가격을 여기에 다시 적지 않는다 — 유일한 출처는 prisma/seed/items.ts의
// PRICE_BY_RARITY이고, 이 라우트는 DB 행의 priceAffinity를 그대로 내려준다.
// 치장은 종족 구분이 없어 누구나 살 수 있다(tribeColor 삭제).

export async function GET() {
  try {
    const user = await getCurrentUser()

    const [items, owned] = await Promise.all([
      // 필터 없음. 사유는 app/pet/cosmetics/page.tsx의 같은 자리 주석 참고
      prisma.cosmeticItem.findMany(),
      prisma.userCosmetic.findMany({
        where: { userId: user.id },
        select: { itemId: true, equipped: true },
      }),
    ])

    const ownedById = new Map(owned.map((row) => [row.itemId, row]))

    // imageKey 그대로가 아니라 완성된 URL을 내린다. 키만 내리면 화면마다 도메인을 붙이게 되고
    // 그러면 CLOUDFRONT_DOMAIN이 클라이언트로 새어 나가야 한다. 조립은 lib/assets.ts의
    // cdnUrl() 한 곳에서만 한다 — 이 라우트와 cosmetics/page.tsx가 갈라지면 목록과 방
    // 배경이 다른 그림이 된다
    //
    // 2026-08-22: name은 DB에 코드로 들어 있다("autumn_path"). 응답에는 표시명만 내린다 —
    // 코드를 내리면 화면마다 이름표를 다시 붙이게 되고 한 곳을 빼먹으면 코드가 그대로 보인다.
    // 정렬은 map보다 **먼저** 한다. compareCosmetics는 코드로 진열 순서를 찾으므로
    // 표시명으로 바꾼 뒤에 정렬하면 사용자가 정한 계절 순서가 한글 가나다순으로 무너진다
    const list = [...items]
      .sort(compareCosmetics)
      .map((item) => ({
        id: item.id,
        name: cosmeticLabel(item.name),
        slot: item.slot,
        rarity: item.rarity,
        affinityOnly: item.affinityOnly,
        priceAffinity: item.priceAffinity,
        // imageKey에 확장자가 이미 붙어 있다(lib/pet.ts BACKGROUNDS: "backgrounds/….png")
        imageUrl: cdnUrl(item.imageKey),
        owned: ownedById.has(item.id),
        equipped: ownedById.get(item.id)?.equipped ?? false,
      }))

    // 별도 도감 화면을 만들지 않고 이 진행률로 겸용한다 (SPEC.md 5절 "제외한 것").
    // 분모는 하드코딩하지 않는다 — 시드가 늘면 자동으로 따라간다.
    // 분자는 owned.length가 아니라 list에서 센다 — 목록에서 빠진 행을 가진 계정이
    // 6분의 7 같은 진행률을 보지 않게 한다
    //
    // affinity는 상점 잔액이다. GET /api/pet/skins가 starShards를 내려주는 것과 같은 형태다
    return ok({
      affinity: user.affinity,
      items: list,
      progress: { owned: list.filter((item) => item.owned).length, total: items.length },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[GET /api/pet/cosmetics]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_BODY", "요청 형식이 잘못되었습니다")
    }

    const { itemId, equipped } = (body ?? {}) as { itemId?: unknown; equipped?: unknown }
    if (typeof itemId !== "string" || itemId.length === 0) {
      return fail("INVALID_ITEM", "치장 아이템을 지정해 주세요")
    }
    if (typeof equipped !== "boolean") {
      return fail("INVALID_EQUIPPED", "착용 여부를 지정해 주세요")
    }

    const result = await prisma.$transaction(async (tx) => {
      // 보유하지 않은 것은 착용할 수 없다. include로 슬롯을 같이 가져온다
      const mine = await tx.userCosmetic.findUnique({
        where: { userId_itemId: { userId: user.id, itemId } },
        include: { item: { select: { slot: true } } },
      })
      if (!mine) return null

      if (equipped) {
        // 슬롯당 1개다. 같은 슬롯에 이미 착용한 것을 먼저 벗긴다.
        // updateMany의 where는 관계 필터를 받지 않으므로 같은 슬롯 아이템 id를 먼저 모은다
        const sameSlot = await tx.cosmeticItem.findMany({
          where: { slot: mine.item.slot },
          select: { id: true },
        })
        await tx.userCosmetic.updateMany({
          where: {
            userId: user.id,
            equipped: true,
            itemId: { in: sameSlot.map((row) => row.id) },
          },
          data: { equipped: false },
        })
      }

      await tx.userCosmetic.update({ where: { id: mine.id }, data: { equipped } })

      // 화면이 슬롯 상태를 다시 맞출 수 있게 착용 중인 것 전체를 돌려준다
      const equippedNow = await tx.userCosmetic.findMany({
        where: { userId: user.id, equipped: true },
        select: { itemId: true, item: { select: { name: true, slot: true } } },
      })

      return {
        slot: mine.item.slot,
        equipped: equippedNow.map((row) => ({
          itemId: row.itemId,
          // GET과 같은 이유로 표시명을 내린다. 화면이 "○○을 착용했어요"에 그대로 쓴다
          name: cosmeticLabel(row.item.name),
          slot: row.item.slot,
        })),
      }
    })

    if (!result) return fail("NOT_OWNED", "아직 가지고 있지 않은 치장입니다", 404)

    return ok(result)
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[POST /api/pet/cosmetics]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
