import { getCurrentUser } from "@/lib/auth"
import { compareCosmetics } from "@/lib/pet"
import { prisma } from "@/lib/prisma"
import CosmeticList, { type CosmeticRow } from "../_components/CosmeticList"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 치장 목록 화면. (SPEC.md 5절)
// 별도 도감 화면을 만들지 않고 이 화면의 수집 진행률로 겸용한다 (5절 "제외한 것").

export const dynamic = "force-dynamic"

export default async function CosmeticsPage() {
  let items: CosmeticRow[]
  let progress: { owned: number; total: number }

  try {
    const user = await getCurrentUser()

    const [all, owned] = await Promise.all([
      prisma.cosmeticItem.findMany(),
      prisma.userCosmetic.findMany({
        where: { userId: user.id },
        select: { itemId: true, equipped: true },
      }),
    ])

    const ownedById = new Map(owned.map((row) => [row.itemId, row]))

    items = all
      .map((item) => ({
        id: item.id,
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        affinityOnly: item.affinityOnly,
        priceAffinity: item.priceAffinity,
        owned: ownedById.has(item.id),
        equipped: ownedById.get(item.id)?.equipped ?? false,
      }))
      .sort(compareCosmetics)
    progress = { owned: owned.length, total: all.length }
  } catch (error) {
    console.error("[/pet/cosmetics]", error)
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-pet">
          <h1 className="hm-card__title">치장</h1>
          <div className="hm-card">
            <p className="hm__lede">치장 목록을 불러오지 못했어요.</p>
            <p className="hm__note">잠시 후 다시 들어와 주세요.</p>
          </div>
        </div>
      </main>
    )
  }

  return <CosmeticList items={items} progress={progress} />
}
