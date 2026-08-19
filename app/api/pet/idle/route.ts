import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { IDLE_CAP_HOURS, IDLE_MAX_SEEDS, IDLE_SEEDS_PER_HOUR, idleAccrual } from "@/lib/pet"
import { prisma } from "@/lib/prisma"
import { calculateReward } from "@/lib/reward"

// 소유자: C. 방치형 자동 획득. (SPEC.md 5절)
//
//   GET  — 지금까지 쌓인 개수를 본다. 쓰기가 없다
//   POST — 수령한다. 씨앗을 올리고 lastIdleClaimAt을 옮긴다
//
// 이쪽은 "획득"이므로 calculateReward()를 통과한다 (SPEC.md 6절: 방치형 수령 포함).
// 씨앗을 쓰는 /api/pet/feed 는 반대로 통과하지 않는다 — 이유는 그 파일 주석에 있다.
//
// 계산은 lib/pet.ts의 idleAccrual()에 있다. 여기는 DB 읽기·쓰기만 한다.

export async function GET() {
  try {
    const user = await getCurrentUserWithSkin()
    const accrual = idleAccrual(user.lastIdleClaimAt, new Date())
    const reward = calculateReward(user.activePetSkin, { seeds: accrual.seeds })

    return ok({
      // 배율까지 얹은 실제 수령 예정 개수. 화면에 이 숫자를 그대로 띄운다
      seeds: reward.seeds ?? 0,
      capped: accrual.capped,
      msToNextSeed: accrual.msToNextSeed,
      perHour: IDLE_SEEDS_PER_HOUR,
      capHours: IDLE_CAP_HOURS,
      maxSeeds: IDLE_MAX_SEEDS,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[GET /api/pet/idle]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}

export async function POST() {
  try {
    const user = await getCurrentUserWithSkin()
    const now = new Date()

    const result = await prisma.$transaction(async (tx) => {
      // 기준 시각을 트랜잭션 안에서 다시 읽는다. 다른 탭이 먼저 받아 갔을 수 있다
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { lastIdleClaimAt: true },
      })

      const accrual = idleAccrual(fresh.lastIdleClaimAt, now)
      const gain = calculateReward(user.activePetSkin, { seeds: accrual.seeds }).seeds ?? 0

      // 첫 접속은 지급이 0이지만 기준 시각을 심어야 한다. 안 심으면 다음에도 계속 0이다.
      const plantsBaseline = fresh.lastIdleClaimAt === null
      if (gain < 1 && !plantsBaseline) return null

      // lastIdleClaimAt을 where에 넣어 낙관적 락으로 쓴다.
      // 버튼 연타로 두 요청이 겹쳐도 두 번째는 count 0이 되어 이중 지급되지 않는다.
      const written = await tx.user.updateMany({
        where: { id: user.id, lastIdleClaimAt: fresh.lastIdleClaimAt },
        data: { seeds: { increment: gain }, lastIdleClaimAt: accrual.nextClaimAt },
      })
      if (written.count !== 1) return null

      const after = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { seeds: true },
      })

      // 수령 **후** 기준으로 다시 계산한다. accrual.msToNextSeed는 수령 전 값이고,
      // 상한에 닿았던 경우 그 값이 0(=받아 가야 다시 쌓인다)이라 그대로 쓰면 틀린다
      return {
        claimed: gain,
        seeds: after.seeds,
        msToNextSeed: idleAccrual(accrual.nextClaimAt, now).msToNextSeed,
      }
    })

    if (!result) return fail("IDLE_EMPTY", "아직 모인 씨앗이 없어요")

    return ok(result)
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[POST /api/pet/idle]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
