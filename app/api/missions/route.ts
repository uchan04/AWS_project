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

    await ensureMissionReset(user)

    // 초기화 후 최신 user 다시 조회
    const refreshedUser = await getCurrentUser()
    const dashboard = await buildDashboard(refreshedUser)

    return ok(dashboard)
  } catch (err: any) {
    if (err.message === "로그인이 필요합니다") {
      return fail("UNAUTHORIZED", err.message, 401)
    }
    console.error("GET /api/missions error:", err)
    return fail("INTERNAL_ERROR", "미션 조회 중 오류가 발생했습니다", 500)
  }
}
