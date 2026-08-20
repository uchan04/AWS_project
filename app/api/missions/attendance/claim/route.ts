import { getCurrentUserWithSkin } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { claimAttendance } from "@/lib/missions/attendance"

export async function POST() {
  try {
    const user = await getCurrentUserWithSkin()

    const result = await claimAttendance(user)

    return ok(result)
  } catch (err) {
    if (err instanceof Error && err.message === "로그인이 필요합니다") {
      return fail("UNAUTHORIZED", err.message, 401)
    }
    console.error("POST /api/missions/attendance/claim error:", err)
    return fail("INTERNAL_ERROR", "출석 수령 중 오류가 발생했습니다", 500)
  }
}
