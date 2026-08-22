import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { assetUrl } from "@/lib/assets"
import { getCurrentUser } from "@/lib/auth"
import { compareCosmetics } from "@/lib/pet"
import { prisma } from "@/lib/prisma"
import CosmeticList, { type CosmeticRow } from "../_components/CosmeticList"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 치장 목록 화면. (SPEC.md 5절)
// 별도 도감 화면을 만들지 않고 이 화면의 수집 진행률로 겸용한다 (5절 "제외한 것").
// typeCode는 화면 색(.pet의 data-tribe)에만 쓴다 — 치장은 종족 제한이 없다(SPEC.md 2절).

export const dynamic = "force-dynamic"

export default async function CosmeticsPage() {
  let items: CosmeticRow[]
  let progress: { owned: number; total: number }
  let affinity: number
  let typeCode: TypeCode | null

  try {
    const user = await getCurrentUser()
    affinity = user.affinity
    typeCode = user.typeCode

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
        // imageKey에 확장자가 이미 붙어 있다(prisma/seed/items.ts: "cosmetics/bg-1.png")
        imageUrl: assetUrl(item.imageKey),
      }))
      .sort(compareCosmetics)
    progress = { owned: owned.length, total: all.length }
  } catch (error) {
    console.error("[/pet/cosmetics]", error)
    return (
      <main className="pet pet--shop">
        <div className="pet__top">
          <h1 className="pet__title">배경 상점</h1>
          <Link className="pet-plank" href="/pet">
            펫으로
          </Link>
        </div>
        <div className="pet-card">
          <h2 className="pet-card__title">배경 목록을 불러오지 못했어요</h2>
          <span className="pet-card__meta">잠시 후 다시 들어와 주세요.</span>
        </div>
      </main>
    )
  }

  return (
    <CosmeticList items={items} progress={progress} affinity={affinity} typeCode={typeCode} />
  )
}
