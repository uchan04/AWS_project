import { getCurrentUser } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { ensureMissionReset } from "@/lib/missions/reset"
import { buildDashboard } from "@/lib/missions/dashboard"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user.typeCode) {
      return fail("DIAGNOSIS_NOT_COMPLETED", "진단을 먼저 완료해주세요", 400)
    }

    // ensureMissionReset이 streakCount를 갱신할 수 있으므로 반환값 사용
    const refreshedUser = await ensureMissionReset(user)

    const dashboard = await buildDashboard(refreshedUser)

    return ok(dashboard)
  } catch (err) {
    if (err instanceof Error && err.message === "로그인이 필요합니다") {
      return fail("UNAUTHORIZED", err.message, 401)
    }
    console.error("GET /api/missions error:", err)
    return fail("INTERNAL_ERROR", "미션 조회 중 오류가 발생했습니다", 500)
  }
}
