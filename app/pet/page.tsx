import { getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage } from "@/lib/pet"
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

    state = {
      level: user.level,
      exp: user.exp,
      evolutionStage: cappedStage(user.level, stageCount),
      seeds: user.seeds,
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
