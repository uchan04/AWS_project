import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage, hungerFor, idleAccrual } from "@/lib/pet"
import { calculateReward } from "@/lib/reward"

// 소유자: C. 펫 화면 초기 상태. (SPEC.md 5절)

export async function GET() {
  try {
    const user = await getCurrentUserWithSkin()
    const stageCount = user.activePetSkin?.stageCount ?? 3
    const now = new Date()

    // 아직 안 받은 방치형 씨앗. 홈 화면(A)에서 "받을 씨앗 N개" 배지로도 쓸 수 있다.
    // 지급은 POST /api/pet/idle 만 한다 — 조회에 쓰기를 섞지 않는다
    const idle = idleAccrual(user.lastIdleClaimAt, now)

    const evolutionStage = cappedStage(user.level, stageCount)

    // S3 이미지 URL 생성
    const cloudfront = process.env.CLOUDFRONT_DOMAIN
    const imageUrl =
      cloudfront && user.activePetSkin
        ? `${cloudfront}/${user.activePetSkin.imageKeyBase}-${evolutionStage}.png`
        : null

    return ok({
      level: user.level,
      exp: user.exp,
      evolutionStage,
      seeds: user.seeds,
      // 한 번도 먹이지 않았으면 가입 시각 기준 (lib/pet.ts hungerFor 주석)
      hunger: hungerFor(user.lastFedAt ?? user.createdAt, now),
      affinity: user.affinity,
      starShards: user.starShards,
      idle: {
        seeds: calculateReward(user.activePetSkin, { seeds: idle.seeds }).seeds ?? 0,
        capped: idle.capped,
        msToNextSeed: idle.msToNextSeed,
      },
      typeCode: user.typeCode,
      nickname: user.nickname,
      imageUrl,
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
