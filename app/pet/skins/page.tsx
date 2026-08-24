import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth"
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
    // 규칙은 app/pet/page.tsx의 imageUrl과 같다: <imageKeyBase>-<단계>.png.
    // **단계는 4단 고정이 아니라 유저의 현재 단계다.** 대표 그림으로 성체(4단)를 쓰면
    // Lv.1 유저가 산 뒤 방에서 다른 그림(알)을 보게 된다 — 8/22에 배경 상점의 크롭을
    // 방 크롭과 맞춘 것과 같은 원칙이다. 상점은 "바꾸면 지금 내 펫이 이렇게 보인다"를
    // 보여 주는 곳이다. 도메인이 비면 null이고 타일은 이모지로 떨어진다
    const cloudfront = process.env.CLOUDFRONT_DOMAIN

    skins = all.map((skin) => ({
      id: skin.id,
      name: skin.name,
      typeCode: skin.typeCode,
      isDefault: skin.isDefault,
      stageCount: skin.stageCount,
      priceShards: skin.priceShards,
      imageUrl: cloudfront
        ? `${cloudfront}/${skin.imageKeyBase}-${cappedStage(user.level, skin.stageCount)}.png`
        : null,
      owned: ownedIds.has(skin.id),
      active: skin.id === user.activePetSkinId,
    }))
    starShards = user.starShards
  } catch (error) {
    console.error("[/pet/skins]", error)
    return (
      <main className="pet pet--shop">
        <div className="pet__top">
          <h1 className="pet__title">외형 상점</h1>
          <Link className="pet-plank" href="/pet">
            펫으로
          </Link>
        </div>
        <div className="pet-card">
          <h2 className="pet-card__title">외형 목록을 불러오지 못했어요</h2>
          <span className="pet-card__meta">잠시 후 다시 들어와 주세요.</span>
        </div>
      </main>
    )
  }

  return <SkinList skins={skins} starShards={starShards} typeCode={typeCode} />
}
