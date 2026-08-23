import { redirect } from "next/navigation"
import { assetUrl, petImageUrl } from "@/lib/assets"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage, daysTogether, hungerFor, idleAccrual, SHIPPED_COSMETIC } from "@/lib/pet"
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
    const stageCount = skin?.stageCount ?? 4

    // 진단 전이면 typeCode가 없다. 기본 펫이 정해지기 전이므로 곰과 색을 임시로 쓴다.
    const tribe = user.typeCode ? TRIBE[user.typeCode] : TRIBE.FAMILY_LIVING

    const now = new Date()

    // 방치형으로 모인 씨앗을 화면에 미리 보여준다. 지급은 유저가 버튼을 눌렀을 때
    // POST /api/pet/idle 이 한다 — 페이지를 열기만 해도 쓰기가 나가면 안 된다.
    const idle = idleAccrual(user.lastIdleClaimAt, now)
    const idleSeeds = calculateReward(skin, { seeds: idle.seeds }).seeds ?? 0

    // 한 번도 먹이지 않았으면 가입 시각을 기준으로 감쇠한다 (lib/pet.ts hungerFor 주석)
    const hunger = hungerFor(user.lastFedAt ?? user.createdAt, now)

    // 두 질의를 **동시에** 보낸다. RDS가 us-east-1이라 순서대로 await하면 왕복이
    // 하나씩 쌓인다(약 175ms/회 실측 — docs/dev/perf.md). 서로 의존하지 않는 읽기다
    const [worn, missionsDone] = await Promise.all([
      // 착용 중인 치장 (SPEC.md 5절)
      prisma.userCosmetic.findMany({
        // 낡은 치장을 착용한 채인 계정이 있다(lib/pet.ts SHIPPED_COSMETIC). 빼지 않으면
        // 방 배경이 뜨지 않는 그림으로 덮여 기본 방 SVG도 안 나온다
        where: { userId: user.id, equipped: true, item: SHIPPED_COSMETIC },
        select: { item: { select: { name: true, slot: true, imageKey: true } } },
      }),
      // 함께한 기록 카드용 누적 완료 수. UserMission 한 행이 완료 한 번이고
      // (completedAt이 not null인 스키마다) 일일 미션은 resetKey가 날짜별로 갈려
      // 같은 미션을 다른 날 한 것도 각각 센다 — "지금까지 몇 번 해냈나"가 맞다
      prisma.userMission.count({ where: { userId: user.id } }),
    ])

    const evolutionStage = cappedStage(user.level, stageCount)
    const imageUrl = skin ? petImageUrl(skin.imageKeyBase, evolutionStage) : null

    // 착용한 배경이 방 배경이 된다 (2026-08-21 사용자 확정). 슬롯당 1개라 첫 행이 유일하다.
    // 없으면 null이고 PetRoom이 기본 방 SVG를 그린다.
    // imageKey에 확장자가 이미 붙어 있다(prisma/seed/items.ts: "cosmetics/bg-1.png").
    const wornBackground = worn.find((row) => row.item.slot === "BACKGROUND")
    const roomImageUrl = wornBackground ? assetUrl(wornBackground.item.imageKey) : null

    // 진화 단계 카드가 단계별 그림을 쓴다. 규칙은 imageUrl과 같은 <base>-<단계>.png다
    // (prisma/seed/items.ts가 imageKeyBase를 고정해 뒀다)
    const stageImageUrls = Array.from({ length: stageCount }, (_, i) =>
      skin ? petImageUrl(skin.imageKeyBase, i + 1) : null,
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
      daysTogether: daysTogether(user.createdAt, now),
      missionsDone,
      attendanceTotal: user.attendanceTotal,
    }
  } catch (error) {
    // 미인증이면 "불러오지 못했어요"가 아니라 로그인이다. 미들웨어가 쿠키 "존재"만 보므로
    // 위조·만료 쿠키를 들고 온 사람이 여기까지 온다 — 그 사람에게 필요한 것도 재로그인이다.
    // /login은 공개 경로라 리다이렉트 루프가 생기지 않는다.
    if (error instanceof UnauthorizedError) redirect("/login?next=%2Fpet")
    console.error("[/pet]", error)
    return (
      <main className="pet pet--shop">
        <div className="pet__top">
          <h1 className="pet__title">펫</h1>
        </div>
        <div className="pet-card">
          <h2 className="pet-card__title">펫 정보를 불러오지 못했어요</h2>
          <span className="pet-card__meta">잠시 후 다시 들어와 주세요.</span>
        </div>
      </main>
    )
  }

  return <PetView initial={state} />
}
