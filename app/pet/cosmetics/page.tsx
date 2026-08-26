import Link from "next/link"
import { redirect } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import { cdnUrl } from "@/lib/assets"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { compareCosmetics, cosmeticLabel } from "@/lib/pet"
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
  let starShards: number
  let typeCode: TypeCode | null

  try {
    const user = await getCurrentUser()
    // 2026-08-25: 배경값이 친밀도 → 별조각으로 바뀌었다(사용자 결정). 이 화면의 잔액도
    // 함께 바뀐다 — 외형 상점(/pet/skins)과 같은 재화를 같은 이름으로 본다
    starShards = user.starShards
    typeCode = user.typeCode

    const [all, owned] = await Promise.all([
      // 필터를 두지 않는다. 전에는 imageKey가 "cosmetics/"로 시작하는 행만 골랐는데
      // (SHIPPED_COSMETIC), C가 배경 6종을 "backgrounds/" 키로 다시 심어서 6행 중
      // **0행**이 걸렸다 — 상점이 빈 화면이었다. 지금 DB의 6행이 곧 판매 목록 전체다
      prisma.cosmeticItem.findMany(),
      prisma.userCosmetic.findMany({
        where: { userId: user.id },
        select: { itemId: true, equipped: true },
      }),
    ])

    const ownedById = new Map(owned.map((row) => [row.itemId, row]))

    // 2026-08-22: 타일에 배경 그림을 띄운다. 그 전까지는 이름과 가격만 있어서 별조각
    // 500을 무엇인지 모르고 내야 했다. 조립은 lib/assets.ts cdnUrl() 한 곳에서만 한다 —
    // imageKey에 확장자가 이미 붙어 있으므로 여기서 .png를 덧붙이지 않는다.
    // 도메인이 비면 null이고 타일은 이름만 보인다

    // 정렬을 map보다 **먼저** 한다. compareCosmetics는 name이 코드일 때 진열 순서를 알고,
    // map이 name을 표시명으로 바꾼 뒤에 정렬하면 코드를 못 찾아 한글 가나다순으로 떨어진다
    // (노을빛 → 눈꽃 → 봄날 → …). 사용자가 정한 계절 순서가 조용히 깨지는 자리다
    items = [...all]
      .sort(compareCosmetics)
      .map((item) => ({
        id: item.id,
        // DB의 name은 코드("autumn_path")다. 화면에는 표시명("노을빛 단풍길")만 보낸다
        name: cosmeticLabel(item.name),
        slot: item.slot,
        rarity: item.rarity,
        priceShards: item.priceShards,
        imageUrl: cdnUrl(item.imageKey),
        owned: ownedById.has(item.id),
        equipped: ownedById.get(item.id)?.equipped ?? false,
      }))

    // 분자를 items에서 센다 — owned.length를 쓰면 목록에서 빠진 행을 가진 계정이
    // 6/6을 넘는 진행률을 본다
    progress = { owned: items.filter((item) => item.owned).length, total: all.length }
  } catch (error) {
    // 미인증이면 로그인으로 보낸다. 아래 카드는 DB 장애용이다(app/pet/page.tsx와 같은 이유)
    if (error instanceof UnauthorizedError) redirect("/login?next=%2Fpet%2Fcosmetics")
    console.error("[/pet/cosmetics]", error)
    return (
      <main className="pet pet--shop">
        {/* 정상 화면과 같은 배너를 쓴다 — 실패한 화면만 머리가 다르면 같은 곳이 아닌 것처럼 보인다.
            장식 이모지는 목록이 없는 자리에 흥을 붙이는 것이라 여기서는 뺀다 */}
        <header className="pet-banner">
          <div className="pet-banner__inner">
            <div>
              <span className="pet-banner__eyebrow" aria-hidden="true">
                ✦ BACKGROUND SHOP ✦
              </span>
              <h1 className="pet__title">배경 상점</h1>
            </div>
            <div className="pet-banner__acts">
              <Link className="pet-plank" href="/pet">
                <span aria-hidden="true">🐾</span> 펫으로
              </Link>
            </div>
          </div>
        </header>
        <div className="pet-card">
          <h2 className="pet-card__title">배경 목록을 불러오지 못했어요</h2>
          <span className="pet-card__meta">잠시 후 다시 들어와 주세요.</span>
        </div>
      </main>
    )
  }

  return (
    <CosmeticList
      items={items}
      progress={progress}
      starShards={starShards}
      typeCode={typeCode}
    />
  )
}
