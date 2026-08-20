import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import SkinList, { type SkinRow } from "../_components/SkinList"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 스킨 목록 화면. (SPEC.md 5절)
// 스킨은 자기 종족 전용이다(2026-08-20 결정). 목록을 user.typeCode로 거른다 —
// 서버 쪽 제한은 POST /api/pet/skins/buy 에도 같이 있다.

export const dynamic = "force-dynamic"

export default async function SkinsPage() {
  let skins: SkinRow[]
  let starShards: number

  try {
    const user = await getCurrentUser()

    const [all, owned] = await Promise.all([
      user.typeCode === null
        ? []
        : prisma.petSkin.findMany({
            where: { typeCode: user.typeCode },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          }),
      prisma.userPetSkin.findMany({ where: { userId: user.id }, select: { petSkinId: true } }),
    ])

    const ownedIds = new Set(owned.map((row) => row.petSkinId))

    skins = all.map((skin) => ({
      id: skin.id,
      name: skin.name,
      typeCode: skin.typeCode,
      isDefault: skin.isDefault,
      stageCount: skin.stageCount,
      priceShards: skin.priceShards,
      owned: ownedIds.has(skin.id),
      active: skin.id === user.activePetSkinId,
    }))
    starShards = user.starShards
  } catch (error) {
    console.error("[/pet/skins]", error)
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-pet">
          <h1 className="hm-card__title">스킨</h1>
          <div className="hm-card">
            <p className="hm__lede">스킨 목록을 불러오지 못했어요.</p>
            <p className="hm__note">잠시 후 다시 들어와 주세요.</p>
          </div>
        </div>
      </main>
    )
  }

  return <SkinList skins={skins} starShards={starShards} />
}
