import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 소유자: C. 캐릭터 목록. (SPEC.md 5절)
// 구매는 POST /api/pet/skins/buy, 전환은 POST /api/pet/skins/activate 다.
//
// 구매 제한을 두지 않는다 — 유형과 무관하게 3종 모두 살 수 있다(SPEC.md 5절).
// 자기 과로 제한하면 유저당 1개뿐이라 "고르고 전환한다"가 사라진다.

export async function GET() {
  try {
    const user = await getCurrentUser()

    const [skins, owned] = await Promise.all([
      prisma.petSkin.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
      prisma.userPetSkin.findMany({
        where: { userId: user.id },
        select: { petSkinId: true },
      }),
    ])

    const ownedIds = new Set(owned.map((row) => row.petSkinId))

    return ok({
      affinity: user.affinity,
      activeSkinId: user.activePetSkinId,
      skins: skins.map((skin) => ({
        id: skin.id,
        name: skin.name,
        typeCode: skin.typeCode,
        isDefault: skin.isDefault,
        stageCount: skin.stageCount,
        effectType: skin.effectType,
        effectPct: skin.effectPct,
        priceAffinity: skin.priceAffinity,
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
