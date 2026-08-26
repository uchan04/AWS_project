import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { loadOutingView, startOuting } from "@/lib/outing"
import { cappedStage } from "@/lib/pet"

// 소유자: C. 펫 외출. (SPEC.md 5절, 계획은 docs/dev/pet.md "펫 외출 시스템")
//
//   GET  — 지금 상태를 본다. 쓰기가 없다
//   POST — 보낸다. 친밀도 200을 차감하고 3축과 보상을 뽑아 저장한다
//
// 값·문구·판정은 lib/pet.ts, DB 경로는 lib/outing.ts에 있다. 여기는 인증과 응답만 한다.
//
// **복귀 지급은 이 라우트가 하지 않는다.** POST /api/pet/outing/claim이 한다 —
// 이유는 lib/outing.ts claimOuting()의 주석에 있다(조회에 쓰기를 섞지 않는다).

export async function GET() {
  try {
    const user = await getCurrentUserWithSkin()
    const view = await loadOutingView(user.id, user.activePetSkin, new Date())
    return ok({ ...view, affinity: user.affinity })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[GET /api/pet/outing]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}

export async function POST() {
  try {
    const user = await getCurrentUserWithSkin()
    const stageCount = user.activePetSkin?.stageCount ?? 4

    // 갈 수 있는 장소는 진화 단계로 좁힌다. User.evolutionStage를 그대로 쓰지 않는 이유는
    // 스킨의 stageCount가 상한이라서다 — 화면·API가 전부 cappedStage()를 통과한다
    const evolutionStage = cappedStage(user.level, stageCount)

    const result = await startOuting(
      { userId: user.id, skin: user.activePetSkin, evolutionStage },
      new Date(),
    )

    if (!result.ok) {
      // NO_TABLE은 마이그레이션 미적용 구간이다. 사용자 잘못이 아니므로 문구가 다르다
      return fail(result.code, result.message, result.code === "NO_TABLE" ? 500 : 400)
    }

    return ok({ ...result.view, affinity: result.affinity })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[POST /api/pet/outing]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
