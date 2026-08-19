import { getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage } from "@/lib/pet"
import { TRIBE } from "@/lib/types"
import PetView, { type PetState } from "./_components/PetView"

// 소유자: C. 펫 화면. (SPEC.md 5절)
// 아직 RDS가 없어 DB 접근이 실패한다. 그 경우 화면을 죽이지 않고 안내를 띄운다.

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
      colorHex: tribe.colorHex,
      skinName: skin?.name ?? tribe.animal,
      stageCount,
      effectLabel:
        skin && skin.effectType !== "NONE" && skin.effectPct > 0
          ? `${EFFECT_LABEL[skin.effectType] ?? "보너스"} +${skin.effectPct}%`
          : null,
    }
  } catch (error) {
    console.error("[/pet]", error)
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 py-8">
        <h1 className="text-lg font-semibold">펫</h1>
        <p className="text-sm text-neutral-600">
          아직 데이터베이스가 연결되지 않아 펫 정보를 불러올 수 없습니다.
        </p>
        <p className="text-xs text-neutral-500">
          `DATABASE_URL`과 마이그레이션이 준비되면 이 화면이 정상 동작합니다. (E 담당)
        </p>
      </main>
    )
  }

  return <PetView initial={state} />
}
