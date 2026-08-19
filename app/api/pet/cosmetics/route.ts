import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { compareCosmetics } from "@/lib/pet"
import { prisma } from "@/lib/prisma"

// 소유자: C. 치장 목록 조회 + 착용·해제. (SPEC.md 5절)
//
//   GET  — 전체 치장 목록 + 보유·착용 여부 + 수집 진행률
//   POST — { itemId, equipped } 로 착용·해제. 슬롯당 1개만 착용된다
//
// 재화가 오가지 않으므로 calculateReward()와 무관하다. 구매·획득은 이 라우트가 하지 않는다
// (치장 획득 경로는 가챠 컷으로 미정. SPEC.md 5절 / docs/dev/pet.md).
// 그래서 지금 이 화면은 정상 동작해도 전부 "미획득"으로 보인다 — 버그가 아니다.

export async function GET() {
  try {
    const user = await getCurrentUser()

    const [items, owned] = await Promise.all([
      prisma.cosmeticItem.findMany(),
      prisma.userCosmetic.findMany({
        where: { userId: user.id },
        select: { itemId: true, equipped: true },
      }),
    ])

    const ownedById = new Map(owned.map((row) => [row.itemId, row]))

    const list = items
      .map((item) => ({
        id: item.id,
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        tribeColor: item.tribeColor,
        affinityOnly: item.affinityOnly,
        priceAffinity: item.priceAffinity,
        owned: ownedById.has(item.id),
        equipped: ownedById.get(item.id)?.equipped ?? false,
      }))
      .sort(compareCosmetics)

    // 별도 도감 화면을 만들지 않고 이 진행률로 겸용한다 (SPEC.md 5절 "제외한 것").
    // 분모는 하드코딩하지 않는다 — 시드가 늘면 자동으로 따라간다
    return ok({ items: list, progress: { owned: owned.length, total: items.length } })
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
          name: row.item.name,
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
