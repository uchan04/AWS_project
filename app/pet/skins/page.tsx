import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { petImageUrl } from "@/lib/assets"
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

    skins = all.map((skin) => ({
      id: skin.id,
      name: skin.name,
      typeCode: skin.typeCode,
      isDefault: skin.isDefault,
      stageCount: skin.stageCount,
      priceShards: skin.priceShards,
      owned: ownedIds.has(skin.id),
      active: skin.id === user.activePetSkinId,
      // 상점 썸네일은 성체(마지막 단계)를 보여준다. GET /api/pet/skins도 같은 규칙이다
      imageUrl: petImageUrl(skin.imageKeyBase, skin.stageCount),
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
