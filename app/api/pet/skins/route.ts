import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 소유자: C. 스킨 목록. (SPEC.md 5절)
// 구매는 POST /api/pet/skins/buy, 전환은 POST /api/pet/skins/activate 다.
//
// 스킨은 자기 종족 전용이다(2026-08-20 결정). 진단으로 정해진 동물은 고정이고
// 살 수 있는 것은 같은 동물의 변종 외형뿐이다(여우 → 북극여우). 그래서 목록을
// user.typeCode로 걸러 보낸다 — 화면에서 거르면 남의 종족 id가 클라이언트로 새어 나가고
// 그 id로 buy를 때릴 수 있다. 진단 전(typeCode = null)이면 빈 목록이다.

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (user.typeCode === null) {
      return ok({ starShards: user.starShards, activeSkinId: user.activePetSkinId, skins: [] })
    }

    const [skins, owned] = await Promise.all([
      prisma.petSkin.findMany({
        where: { typeCode: user.typeCode },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      prisma.userPetSkin.findMany({
        where: { userId: user.id },
        select: { petSkinId: true },
      }),
    ])

    const ownedIds = new Set(owned.map((row) => row.petSkinId))

    return ok({
      starShards: user.starShards,
      activeSkinId: user.activePetSkinId,
      skins: skins.map((skin) => ({
        id: skin.id,
        name: skin.name,
        typeCode: skin.typeCode,
        isDefault: skin.isDefault,
        stageCount: skin.stageCount,
        priceShards: skin.priceShards,
        owned: ownedIds.has(skin.id),
        active: skin.id === user.activePetSkinId,
      })),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[GET /api/pet/skins]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
