import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { GalleryType } from "@prisma/client"
import { canAccessGallery } from "@/app/community/_lib/gallery"
import { pickTopics } from "@/app/community/_lib/topics"

// GET /api/community/topics?gallery=ALL — 글쓰기 창의 주제 추천 3개(SPEC 8절).
//
// **제목만 준다.** 초안은 만들지 않는다(2026-08-25 사용자 결정, _lib/topics.ts 주석 참고).
//
// **Bedrock을 부르지 않는다.** 같은 날 LLM 추천을 껐다 — 전에는 lib/community/topics.ts의
// suggestTopics()가 만들었고 이 라우트가 유일한 호출부였다. 지금 문구의 출처는
// app/community/_lib/topics.ts 하나뿐이라 이 응답은 실패할 일이 없다.
//
// 종족은 세션에서 읽는다. 쿼리로 받지 않는다 — 클라이언트가 보낸 종족을 믿으면
// 남의 종족 문구를 뽑아볼 수 있다. 갤러리는 쿼리로 받되 소속을 검사한다(글 작성과 같은 규칙).
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const requested = request.nextUrl.searchParams.get("gallery") ?? GalleryType.ALL
    const gallery = (Object.values(GalleryType) as string[]).includes(requested)
      ? (requested as GalleryType)
      : null
    if (!gallery) return fail("INVALID_BODY", "갤러리를 찾을 수 없어요", 400)

    if (!canAccessGallery(gallery, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리는 볼 수 없어요", 400)
    }

    return ok({ topics: pickTopics(gallery, user.typeCode) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
