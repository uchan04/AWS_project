import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 소유자: C. 친밀도 전용 캐릭터 구매 (각 300 친밀도). (SPEC.md 5절)
//
// calculateReward()를 통과하지 않는 이유는 /api/pet/feed 와 같다 —
// 저 함수는 재화를 "획득"할 때 배율을 얹는다. 여기는 친밀도를 쓰는 쪽이다.
// 가격에 배율을 얹으면 300을 내야 하는데 345가 빠진다.
//
// 구매만 한다. 전환은 POST /api/pet/skins/activate 가 따로 한다 —
// 산 캐릭터를 바로 켜지 않는 유저도 있고, 두 동작을 섞으면 되돌릴 수 없다.

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_BODY", "요청 형식이 잘못되었습니다")
    }

    const skinId = (body as { skinId?: unknown })?.skinId
    if (typeof skinId !== "string" || skinId.length === 0) {
      return fail("INVALID_SKIN", "구매할 캐릭터를 지정해 주세요")
    }

    const skin = await prisma.petSkin.findUnique({ where: { id: skinId } })
    if (!skin) return fail("SKIN_NOT_FOUND", "없는 캐릭터입니다", 404)

    // 기본 펫(여우·고양이·곰)은 진단으로 지급된다. 가격이 없으므로 살 수 없다
    if (skin.priceAffinity === null) {
      return fail("NOT_FOR_SALE", "구매할 수 없는 캐릭터입니다")
    }
    const price = skin.priceAffinity

    const result = await prisma.$transaction(async (tx) => {
      // 이미 가진 것을 또 사면 친밀도만 빠진다. 유니크 제약이 잡아 주지만
      // 그건 500이 되므로 먼저 확인해 400으로 돌려준다
      const already = await tx.userPetSkin.findUnique({
        where: { userId_petSkinId: { userId: user.id, petSkinId: skin.id } },
      })
      if (already) return { code: "ALREADY_OWNED" as const }

      // 연타로 두 요청이 겹치면 잔액보다 많이 빠질 수 있어 조건부 UPDATE로 깎는다.
      // affinity >= price 를 where에 넣으면 두 번째 요청은 count 0이 된다
      const paid = await tx.user.updateMany({
        where: { id: user.id, affinity: { gte: price } },
        data: { affinity: { decrement: price } },
      })
      if (paid.count !== 1) return { code: "NOT_ENOUGH_AFFINITY" as const }

      await tx.userPetSkin.create({ data: { userId: user.id, petSkinId: skin.id } })

      const after = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { affinity: true },
      })

      return { code: "OK" as const, affinity: after.affinity }
    })

    if (result.code === "ALREADY_OWNED") {
      return fail("ALREADY_OWNED", "이미 가지고 있는 캐릭터입니다")
    }
    if (result.code === "NOT_ENOUGH_AFFINITY") {
      return fail("NOT_ENOUGH_AFFINITY", `친밀도가 부족합니다 (${price} 필요)`)
    }

    return ok({ skinId: skin.id, name: skin.name, affinity: result.affinity })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[POST /api/pet/skins/buy]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
