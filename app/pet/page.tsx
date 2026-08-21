import { getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage, hungerFor, idleAccrual } from "@/lib/pet"
import { prisma } from "@/lib/prisma"
import { calculateReward } from "@/lib/reward"
import { TRIBE } from "@/lib/types"
import PetView, { type PetState } from "./_components/PetView"
import "@/styles/tokens.css"
import "./pet.css"

// 소유자: C. 펫 화면. (SPEC.md 5절)
// DB나 인증이 실패해도 화면을 죽이지 않고 안내를 띄운다.

// 유저별 데이터를 읽으므로 정적 프리렌더 대상이 아니다.
// 이걸 빼면 빌드 시점에 DB 미연결 안내 화면이 정적으로 굳어 DB가 붙은 뒤에도 그대로 나온다.
export const dynamic = "force-dynamic"

const EFFECT_LABEL: Record<string, string> = {
  SEED: "씨앗 획득",
  SHARD: "별조각 획득",
  AFFINITY: "친밀도 획득",
}

export default async function PetPage() {
  let state: PetState

  try {
    const user = await getCurrentUserWithSkin()
    const skin = user.activePetSkin
    const stageCount = skin?.stageCount ?? 3

    // 진단 전이면 typeCode가 없다. 기본 펫이 정해지기 전이므로 곰과 색을 임시로 쓴다.
    const tribe = user.typeCode ? TRIBE[user.typeCode] : TRIBE.FAMILY_LIVING

    const now = new Date()

    // 방치형으로 모인 씨앗을 화면에 미리 보여준다. 지급은 유저가 버튼을 눌렀을 때
    // POST /api/pet/idle 이 한다 — 페이지를 열기만 해도 쓰기가 나가면 안 된다.
    const idle = idleAccrual(user.lastIdleClaimAt, now)
    const idleSeeds = calculateReward(skin, { seeds: idle.seeds }).seeds ?? 0

    // 한 번도 먹이지 않았으면 가입 시각을 기준으로 감쇠한다 (lib/pet.ts hungerFor 주석)
    const hunger = hungerFor(user.lastFedAt ?? user.createdAt, now)

    // 착용 중인 치장 (SPEC.md 5절)
    const worn = await prisma.userCosmetic.findMany({
      where: { userId: user.id, equipped: true },
      select: { item: { select: { name: true, slot: true, imageKey: true } } },
    })

    const evolutionStage = cappedStage(user.level, stageCount)
    const cloudfront = process.env.CLOUDFRONT_DOMAIN
    const imageUrl = cloudfront && skin ? `${cloudfront}/${skin.imageKeyBase}-${evolutionStage}.png` : null

    // 착용한 배경이 방 배경이 된다 (2026-08-21 사용자 확정). 슬롯당 1개라 첫 행이 유일하다.
    // 없으면 null이고 PetRoom이 기본 방 SVG를 그린다 — 지금은 UserCosmetic이 0행이라 전원 기본 방이다.
    // imageKey에 확장자가 이미 붙어 있다(prisma/seed/items.ts: "cosmetics/bg-1.png").
    const wornBackground = worn.find((row) => row.item.slot === "BACKGROUND")
    const roomImageUrl =
      cloudfront && wornBackground ? `${cloudfront}/${wornBackground.item.imageKey}` : null

    // 진화 단계 카드가 단계별 그림을 쓴다. 규칙은 imageUrl과 같은 <base>-<단계>.png다
    // (prisma/seed/items.ts가 imageKeyBase를 고정해 뒀다)
    const stageImageUrls = Array.from({ length: stageCount }, (_, i) =>
      cloudfront && skin ? `${cloudfront}/${skin.imageKeyBase}-${i + 1}.png` : null,
    )

    state = {
      level: user.level,
      exp: user.exp,
      evolutionStage,
      seeds: user.seeds,
      hunger,
      idleSeeds,
      idleCapped: idle.capped,
      msToNextSeed: idle.msToNextSeed,
      worn: worn.map((row) => row.item.name),
      animal: skin?.name ?? tribe.animal,
      family: tribe.family,
      colorName: tribe.colorName,
      skinName: skin?.name ?? tribe.animal,
      typeCode: user.typeCode ?? null,
      stageCount,
      effectLabel:
        skin && skin.effectType !== "NONE" && skin.effectPct > 0
          ? `${EFFECT_LABEL[skin.effectType] ?? "보너스"} +${skin.effectPct}%`
          : null,
      imageUrl,
      stageImageUrls,
      roomImageUrl,
    }
  } catch (error) {
    console.error("[/pet]", error)
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-pet">
          <h1 className="hm-card__title">펫</h1>
          <div className="hm-card">
            <p className="hm__lede">펫 정보를 불러오지 못했어요.</p>
            <p className="hm__note">잠시 후 다시 들어와 주세요.</p>
          </div>
        </div>
      </main>
    )
  }

  return <PetView initial={state} />
}
