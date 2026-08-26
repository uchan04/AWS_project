import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { recordAttempt, retryAfter } from "@/lib/ratelimit"
import { UploadError, generateCommunityPresignedUrl } from "@/lib/uploads"

// 커뮤니티 글 이미지용 presigned PUT 발급. 미션용(`app/api/upload/presign`)과 나눠 둔 이유는
// `lib/uploads.ts` 머리 주석에 있다.
//
// **여기에만 횟수 제한이 있는 이유.** 미션 presign은 missionId가 완료 가능한 사진 미션인지까지
// 검사해서 발급 횟수가 미션 개수에 자연히 묶인다. 글 이미지에는 그런 관문이 없어서, 인증만
// 통과하면 공개 버킷에 쓸 수 있는 URL을 무제한으로 받는 형태가 된다. 글 자체가 10분에 5건이므로
// (`app/api/community/posts/route.ts`) 20건이면 정상 사용자는 닿지 않는다. 재시도·교체 여유다.
//
// IP가 아니라 userId로 센다 — 인증 뒤라 그럴 수 있고, IP는 위조되며 공유 회선이면 남까지 막는다
// (D가 글쓰기에 쓴 판단과 같다).
const PRESIGN_LIMIT = 20
const PRESIGN_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    const rateKey = `presign:community:${user.id}`
    const wait = retryAfter(rateKey, PRESIGN_LIMIT)
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60)
      return fail(
        "TOO_MANY_ATTEMPTS",
        `사진을 너무 빠르게 올리고 있어요. ${minutes}분 후에 다시 시도해 주세요`,
        400,
      )
    }

    const payload = await request.json().catch(() => null)
    const contentType = typeof payload?.contentType === "string" ? payload.contentType : ""
    const fileSize = typeof payload?.fileSize === "number" ? payload.fileSize : 0

    if (!contentType || !fileSize) {
      return fail("INVALID_INPUT", "파일 정보가 누락되었습니다", 400)
    }

    const result = await generateCommunityPresignedUrl({
      userId: user.id,
      contentType,
      fileSize,
    })

    // 발급에 성공한 것만 센다. 형식·크기로 거절된 시도까지 세면 파일을 잘못 고른 사용자가
    // 제대로 고른 뒤에 막힌다.
    recordAttempt(rateKey, PRESIGN_WINDOW_MS)

    return ok(result)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return fail("UNAUTHORIZED", err.message, 401)
    }
    if (err instanceof UploadError) {
      // 500은 설정 오류(S3_BUCKET 미설정)뿐이다. 사용자에게 보이는 문장에는 원인이 없으므로
      // 서버 로그에 남긴다.
      if (err.status >= 500) console.error("POST /api/upload/community/presign:", err.code, err.message)
      return fail(err.code, err.message, err.status)
    }
    console.error("POST /api/upload/community/presign error:", err)
    return fail("INTERNAL_ERROR", "업로드 URL 생성 중 오류가 발생했습니다", 500)
  }
}
