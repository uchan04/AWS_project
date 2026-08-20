import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage, idleAccrual } from "@/lib/pet"
import { calculateReward } from "@/lib/reward"

// 소유자: C. 펫 화면 초기 상태. (SPEC.md 5절)

export async function GET() {
  try {
    const user = await getCurrentUserWithSkin()
    const stageCount = user.activePetSkin?.stageCount ?? 3

    // 아직 안 받은 방치형 씨앗. 홈 화면(A)에서 "받을 씨앗 N개" 배지로도 쓸 수 있다.
    // 지급은 POST /api/pet/idle 만 한다 — 조회에 쓰기를 섞지 않는다
    const idle = idleAccrual(user.lastIdleClaimAt, new Date())

    return ok({
      level: user.level,
      exp: user.exp,
      // 저장값이 레벨과 어긋나 있어도 화면은 레벨 기준으로 보여준다.
      // (미션 보상이 씨앗만 올리고 진화 단계를 갱신하지 않은 경우 등)
      evolutionStage: cappedStage(user.level, stageCount),
      seeds: user.seeds,
      idle: {
        seeds: calculateReward(user.activePetSkin, { seeds: idle.seeds }).seeds ?? 0,
        capped: idle.capped,
        msToNextSeed: idle.msToNextSeed,
      },
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
