import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { suggestTopics } from "@/lib/community/topics"

// GET /api/community/topics — 글쓰기 창의 주제 추천 3개(SPEC 8절).
//
// 종족은 세션에서 읽는다. 쿼리로 받지 않는다 — 갤러리 탭이 아니라 "사용자 성향"이 기준이고,
// 클라이언트가 보낸 종족을 믿으면 남의 종족 문구를 뽑아볼 수 있다.
//
// 실패해도 500을 내지 않는다. 추천은 글쓰기의 곁가지고, 없어도 글은 쓸 수 있다.
// 화면은 이 응답이 실패하면 고정 문구(app/community/_lib/topics.ts)로 되돌아간다.
export async function GET() {
  try {
    const user = await getCurrentUser()

    // 진단 전이면 추천할 성향이 없다. 화면은 이때 추천 영역을 그리지 않는다
    if (!user.typeCode) return ok({ topics: [] })

    try {
      return ok({ topics: await suggestTopics(user.typeCode) })
    } catch (error) {
      // Bedrock 호출 실패·검증 실패. 로그만 남기고 빈 목록을 준다
      console.error("[/api/community/topics]", error)
      return ok({ topics: [] })
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
