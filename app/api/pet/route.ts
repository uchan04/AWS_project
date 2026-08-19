import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage } from "@/lib/pet"

// 소유자: C. 펫 화면 초기 상태. (SPEC.md 5절)

export async function GET() {
  try {
    const user = await getCurrentUserWithSkin()
    const stageCount = user.activePetSkin?.stageCount ?? 3

    return ok({
      level: user.level,
      exp: user.exp,
      // 저장값이 레벨과 어긋나 있어도 화면은 레벨 기준으로 보여준다.
      // (미션 보상이 씨앗만 올리고 진화 단계를 갱신하지 않은 경우 등)
      evolutionStage: cappedStage(user.level, stageCount),
      seeds: user.seeds,
      typeCode: user.typeCode,
      nickname: user.nickname,
      skin: user.activePetSkin
        ? {
            name: user.activePetSkin.name,
            stageCount: user.activePetSkin.stageCount,
            imageKeyBase: user.activePetSkin.imageKeyBase,
            effectType: user.activePetSkin.effectType,
            effectPct: user.activePetSkin.effectPct,
          }
        : null,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[GET /api/pet]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
