import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import SkinList, { type SkinRow } from "../_components/SkinList"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 캐릭터 목록 화면. (SPEC.md 5절)
// 구매 제한 없음 — 유형과 무관하게 친밀도 캐릭터 3종 모두 살 수 있다.

export const dynamic = "force-dynamic"

export default async function SkinsPage() {
  let skins: SkinRow[]
  let affinity: number

  try {
    const user = await getCurrentUser()

    const [all, owned] = await Promise.all([
      prisma.petSkin.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
      prisma.userPetSkin.findMany({ where: { userId: user.id }, select: { petSkinId: true } }),
    ])

    const ownedIds = new Set(owned.map((row) => row.petSkinId))

    skins = all.map((skin) => ({
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
    }))
    affinity = user.affinity
  } catch (error) {
    console.error("[/pet/skins]", error)
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-pet">
          <h1 className="hm-card__title">캐릭터</h1>
          <div className="hm-card">
            <p className="hm__lede">캐릭터 목록을 불러오지 못했어요.</p>
            <p className="hm__note">잠시 후 다시 들어와 주세요.</p>
          </div>
        </div>
      </main>
    )
  }

  return <SkinList skins={skins} affinity={affinity} />
}
