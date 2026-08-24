import Link from "next/link"
import { redirect } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import { petImageUrl } from "@/lib/assets"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { cappedStage } from "@/lib/pet"
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
  let typeCode: TypeCode | null

  try {
    const user = await getCurrentUser()
    typeCode = user.typeCode

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

    // 2026-08-24: 타일에 실제 외형 그림을 띄운다. 그 전까지 이 화면만 이모지(🦊 3종)였다 —
    // 배경 상점은 8/22에 그림이 붙었고 홈·진화 카드도 그림인데, 별조각 2500을 내는 화면이
    // 무엇을 사는지 안 보여 주고 있었다. 변종 스킨은 이모지가 기본 종족과 같아서
    // (lib/pet.ts animalEmoji: 어미로 찾는다) 여우와 북극여우가 화면에서 구분되지 않았다.
    //
    // 주소 조립은 lib/assets.ts의 petImageUrl 하나만 쓴다(2026-08-24 머지). 여기서
    // `${CLOUDFRONT_DOMAIN}/${key}`를 직접 만들던 것을 걷었다 — 그 함수가 스킴 없는
    // 도메인 값을 보정하는데(lib/assets.ts cdnOrigin 주석) 손으로 조립하면 그 보정이 빠져
    // 상대 경로가 되고 404다.
    //
    // **단계는 마지막 단계 고정이 아니라 유저의 현재 단계다** (2026-08-24 사용자 결정).
    // 대표 그림으로 성체를 쓰면 Lv.1 유저가 산 뒤 방에서 다른 그림(알)을 보게 된다 —
    // 8/22에 배경 상점의 크롭을 방 크롭과 맞춘 것과 같은 원칙이다. 상점은 "바꾸면 지금
    // 내 펫이 이렇게 보인다"를 보여 주는 곳이다.
    // GET /api/pet/skins는 성체를 내린다 — 그쪽은 화면이 아니라 목록 데이터라 유저 레벨이
    // 개입하지 않는 편이 맞고, 이 화면은 그 API를 쓰지 않는다(서버에서 직접 읽는다).
    // 도메인이 비면 petImageUrl이 null이고 타일은 이모지로 떨어진다
    skins = all.map((skin) => ({
      id: skin.id,
      name: skin.name,
      typeCode: skin.typeCode,
      isDefault: skin.isDefault,
      stageCount: skin.stageCount,
      priceShards: skin.priceShards,
      imageUrl: petImageUrl(skin.imageKeyBase, cappedStage(user.level, skin.stageCount)),
      owned: ownedIds.has(skin.id),
      active: skin.id === user.activePetSkinId,
    }))
    starShards = user.starShards
  } catch (error) {
    // 미인증이면 로그인으로 보낸다. 아래 카드는 DB 장애용이다(app/pet/page.tsx와 같은 이유)
    if (error instanceof UnauthorizedError) redirect("/login?next=%2Fpet%2Fskins")
    console.error("[/pet/skins]", error)
    return (
      <main className="pet pet--shop">
        {/* 정상 화면과 같은 배너를 쓴다 — 실패한 화면만 머리가 다르면 같은 곳이 아닌 것처럼 보인다.
            장식 이모지는 목록이 없는 자리에 흥을 붙이는 것이라 여기서는 뺀다 */}
        <header className="pet-banner">
          <div className="pet-banner__inner">
            <div>
              <span className="pet-banner__eyebrow" aria-hidden="true">
                ✦ APPEARANCE SHOP ✦
              </span>
              <h1 className="pet__title">외형 상점</h1>
            </div>
            <div className="pet-banner__acts">
              <Link className="pet-plank" href="/pet">
                <span aria-hidden="true">🐾</span> 펫으로
              </Link>
            </div>
          </div>
        </header>
        <div className="pet-card">
          <h2 className="pet-card__title">외형 목록을 불러오지 못했어요</h2>
          <span className="pet-card__meta">잠시 후 다시 들어와 주세요.</span>
        </div>
      </main>
    )
  }

  return <SkinList skins={skins} starShards={starShards} typeCode={typeCode} />
}
