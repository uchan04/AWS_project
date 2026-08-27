import Link from "next/link"
import { redirect } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import { petImageUrl, cdnUrl } from "@/lib/assets"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { cappedStage, compareCosmetics, cosmeticLabel } from "@/lib/pet"
import { prisma } from "@/lib/prisma"
import SkinList, { type SkinRow } from "../_components/SkinList"
import CosmeticList, { type CosmeticRow } from "../_components/CosmeticList"
import { CurrencyIcon } from "@/app/components/CurrencyIcon"
import "@/styles/tokens.css"
import "../pet.css"

export const dynamic = "force-dynamic"

const ko = (n: number) => n.toLocaleString("ko-KR")

export default async function ShopPage() {
  let skins: SkinRow[] = []
  let items: CosmeticRow[] = []
  let progress: { owned: number; total: number } = { owned: 0, total: 0 }
  let starShards = 0
  let typeCode: TypeCode | null = null

  try {
    const user = await getCurrentUser()
    typeCode = user.typeCode
    starShards = user.starShards

    const [allSkins, ownedSkins, allCosmetics, ownedCosmetics] = await Promise.all([
      user.typeCode === null
        ? []
        : prisma.petSkin.findMany({
            where: { typeCode: user.typeCode },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          }),
      prisma.userPetSkin.findMany({ where: { userId: user.id }, select: { petSkinId: true } }),
      prisma.cosmeticItem.findMany(),
      prisma.userCosmetic.findMany({
        where: { userId: user.id },
        select: { itemId: true, equipped: true },
      }),
    ])

    const ownedSkinIds = new Set(ownedSkins.map((row) => row.petSkinId))
    skins = allSkins.map((skin) => ({
      id: skin.id,
      name: skin.name,
      typeCode: skin.typeCode,
      isDefault: skin.isDefault,
      stageCount: skin.stageCount,
      priceShards: skin.priceShards,
      imageUrl: petImageUrl(skin.imageKeyBase, cappedStage(user.level, skin.stageCount)),
      owned: ownedSkinIds.has(skin.id),
      active: skin.id === user.activePetSkinId,
    }))

    const ownedCosmeticById = new Map(ownedCosmetics.map((row) => [row.itemId, row]))
    items = [...allCosmetics]
      .sort(compareCosmetics)
      .map((item) => ({
        id: item.id,
        name: cosmeticLabel(item.name),
        slot: item.slot,
        rarity: item.rarity,
        priceShards: item.priceShards,
        imageUrl: cdnUrl(item.imageKey),
        owned: ownedCosmeticById.has(item.id),
        equipped: ownedCosmeticById.get(item.id)?.equipped ?? false,
      }))

    progress = { owned: items.filter((item) => item.owned).length, total: allCosmetics.length }
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login?next=%2Fpet%2Fshop")
    console.error("[/pet/shop]", error)
    return (
      <main className="pet pet--shop w-full" style={{ padding: 0, paddingBottom: "100px" }}>
        <header className="pet-banner sticky top-0 z-50 w-full flex justify-center items-center" style={{ margin: 0 }}>
          <div className="pet-banner__inner w-full flex justify-between items-center max-w-[46rem] relative">
            <Link href="/pet" className="pet-plank font-bold z-10">
               &lt; 펫으로
            </Link>
            <div className="absolute left-0 right-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <h2 className="text-xl sm:text-2xl font-black text-white" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>상점 SHOP</h2>
              <p className="text-sm font-bold text-white/90 hidden sm:block mt-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>펫을 꾸며줄 아이템을 둘러보세요</p>
            </div>
          </div>
        </header>
        <div className="w-full flex justify-center px-4 sm:px-6">
          <div className="pet-card w-full max-w-[46rem]" style={{ marginTop: "24px" }}>
            <h2 className="pet-card__title">상점 목록을 불러오지 못했어요</h2>
            <span className="pet-card__meta">잠시 후 다시 들어와 주세요.</span>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pet pet--shop w-full" data-tribe={typeCode ?? undefined} style={{ padding: 0, paddingBottom: "100px" }}>
      <header className="pet-banner sticky top-0 z-50 w-full flex justify-center items-center" style={{ margin: 0 }}>
        <div className="pet-banner__inner w-full flex justify-between items-center max-w-[46rem] relative">
          <Link href="/pet" className="pet-plank font-bold z-10">
            &lt; 펫으로
          </Link>
          <div className="absolute left-0 right-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <h2 className="text-xl sm:text-2xl font-black text-white" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>상점 SHOP</h2>
            <p className="text-sm font-bold text-white/90 hidden sm:block mt-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>펫을 꾸며줄 아이템을 둘러보세요</p>
          </div>
          <div className="pet-hud font-bold z-10">
            <span className="pet-hud__icon"><CurrencyIcon currency="starShard" size={18} /></span>
            <span className="pet-hud__value">{ko(starShards)}</span>
          </div>
        </div>
      </header>

      <div className="w-full flex justify-center px-4 sm:px-6">
        <div className="w-full max-w-[46rem] flex flex-col gap-5 mt-6">
          <section>
            <SkinList skins={skins} starShards={starShards} typeCode={typeCode} />
          </section>
          
          <section>
            <CosmeticList items={items} progress={progress} starShards={starShards} typeCode={typeCode} />
          </section>
        </div>
      </div>
    </main>
  )
}
