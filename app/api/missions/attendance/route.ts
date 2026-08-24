import { getCurrentUser } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { listClaimedDates } from "@/lib/missions/attendance"
import { getTodayKey } from "@/lib/missions/reset"
import { isValidMonthKey } from "@/lib/missions/calendar"

// 출석 캘린더가 이번 달이 아닌 월로 이동할 때 쓴다.
// 이번 달은 GET /api/missions의 attendance.claimedDates에 이미 들어 있어 이 요청이 안 난다.

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    const month = new URL(request.url).searchParams.get("month") ?? getTodayKey().slice(0, 7)

    if (!isValidMonthKey(month)) {
      return fail("INVALID_MONTH", "조회할 월 형식이 올바르지 않습니다 (YYYY-MM)", 400)
    }

    // 남의 기록이 섞이지 않도록 항상 인증된 사용자 id로만 조회한다
    const claimedDates = await listClaimedDates(user.id, month)

    return ok({ month, todayKey: getTodayKey(), claimedDates })
  } catch (err) {
    if (err instanceof Error && err.message === "로그인이 필요합니다") {
      return fail("UNAUTHORIZED", err.message, 401)
    }
    console.error("GET /api/missions/attendance error:", err)
    return fail("INTERNAL_ERROR", "출석 기록 조회 중 오류가 발생했습니다", 500)
  }
}
