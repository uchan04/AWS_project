import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { applySeeds } from "@/lib/pet"
import { prisma } from "@/lib/prisma"

// 소유자: C. 씨앗을 펫 경험치로 투입한다. (SPEC.md 5절)
//
// calculateReward()를 통과하지 않는 이유:
//   저 함수는 재화를 "획득"할 때 캐릭터 배율을 얹는 함수다. 여기는 씨앗을 쓰는 쪽이다.
//   투입량에 배율을 얹으면 10개를 넣었는데 11개가 빠진다. 획득 경로(미션·방치형·출석)만
//   저 함수를 통과한다. SPEC.md 6절의 목록에도 투입은 없다.

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserWithSkin()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_BODY", "요청 형식이 잘못되었습니다")
    }

    const seeds = (body as { seeds?: unknown })?.seeds
    if (typeof seeds !== "number" || !Number.isInteger(seeds) || seeds < 1) {
      return fail("INVALID_SEEDS", "투입할 씨앗 개수를 1개 이상으로 지정해 주세요")
    }

    const stageCount = user.activePetSkin?.stageCount ?? 4
    const now = new Date()

    // 씨앗 차감과 성장 반영을 한 트랜잭션에 묶는다.
    // 연타로 두 요청이 겹치면 잔액보다 많이 빠질 수 있어 트랜잭션 안에서 다시 읽는다.
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { seeds: true, level: true, exp: true, evolutionStage: true },
      })

      if (fresh.seeds < seeds) return null

      const growth = applySeeds(fresh, seeds, stageCount)
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          seeds: { decrement: seeds },
          level: growth.level,
          exp: growth.exp,
          evolutionStage: growth.evolutionStage,
          // 배고픔 게이지는 2026-08-21에 삭제했지만 이 기록은 계속 남긴다.
          // 지금 읽는 곳은 없다 — 되살릴 때 공백 구간이 생기지 않게 두는 것이다
          // (lib/pet.ts "배고픔 — 삭제" 주석)
          lastFedAt: now,
        },
        select: { seeds: true, level: true, exp: true, evolutionStage: true },
      })

      return { ...updated, gainedLevels: growth.gainedLevels, evolvedTo: growth.evolvedTo }
    })

    if (!result) return fail("NOT_ENOUGH_SEEDS", "씨앗이 부족합니다")

    // S3 이미지 URL 생성
    const cloudfront = process.env.CLOUDFRONT_DOMAIN
    const imageUrl =
      cloudfront && user.activePetSkin
        ? `${cloudfront}/${user.activePetSkin.imageKeyBase}-${result.evolutionStage}.png`
        : null

    return ok({ ...result, imageUrl })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[POST /api/pet/feed]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
