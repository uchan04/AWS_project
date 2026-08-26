import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomBytes } from "crypto"

// 소유자: E. 미션이 아닌 사용자 업로드(커뮤니티 글 이미지)의 presigned PUT 발급 경로다.
// D의 요청으로 열었다(2026-08-24) — `POST /api/upload/presign`은 missionId가 필수이고
// `loadCompletableMission()`을 통과해야 해서 커뮤니티에서 부를 수 없었다.
//
// **`lib/missions/upload.ts`를 고쳐 쓰지 않고 새로 둔 이유.** 그 파일의 `ALLOWED_TYPES`·
// `MAX_SIZE`는 모듈 상수이고 `verifyS3Object()`가 같은 값을 읽는다. 커뮤니티에 맞춰 5MB·webp로
// 올리면 **미션 사진 검증도 함께 느슨해진다** — 미션 사진은 비전 모델(`lib/missions/vision.ts`)에
// 그대로 넘어가는 입력이라 상한을 건드리지 않는 것이 맞다. presign 기계장치(S3Client +
// getSignedUrl)가 두 벌이 된 것은 그 대가다. 한쪽만 고쳐도 조용히 어긋나지 않게 두 파일이
// 공유하는 불변식을 여기 적어 둔다:
//   1. 키는 **서버가 정한다.** 클라이언트가 보낸 파일명은 쓰지 않는다
//   2. 첫 세그먼트가 용도를 가른다 — `missions/`는 미션 사진, `community/`는 글 이미지
//   3. 두 번째 세그먼트는 항상 userId다. 그래서 S3를 부르지 않고 키만 보고 소유권을 판정한다
//
// **올라간 키는 공개 URL이다.** 버킷 `welli-uploads-185236887369`은 CloudFront
// (`diros91hbap9v`) origin과 같고 버킷 정책이 `/*` 전체를 OAC에 읽기 허용한다(2026-08-24 실측,
// 배포에 path pattern 제한도 없다). 글 이미지는 공개가 의도이므로 presigned GET을 만들 필요가
// 없고 `lib/assets.ts:cdnUrl()`로 그대로 보여주면 된다. 같은 이유로 **여기에 사적인 사진을
// 올리는 용도를 새로 붙이지 않는다** — 붙이려면 prefix 단위 접근 제어가 먼저다.

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
})

/**
 * 버킷 이름. **모듈 로드 시점에 상수로 붙잡지 않는다.** `lib/auth.ts:38-40`이 같은 함정을
 * 기록해 뒀다 — 로드 시점에 환경변수를 읽으면 "환경변수가 런타임에 안 실린 배포"에서
 * 원인이 보이지 않는 실패가 된다. 부를 때마다 읽고, 없으면 여기서 끊는다.
 */
function bucket(): string {
  const name = process.env.S3_BUCKET?.trim()
  if (!name) {
    throw new UploadError(
      "UPLOAD_NOT_CONFIGURED",
      "지금은 사진을 올릴 수 없어요. 잠시 후 다시 시도해 주세요",
      500,
    )
  }
  return name
}

/**
 * 허용 타입 → 확장자. **삼항이 아니라 map으로 둔다.** 미션 쪽은
 * `contentType === "image/jpeg" ? "jpg" : "png"`라서 타입을 하나 늘리면 webp가 `.png` 키로
 * 올라간다. 여기서는 타입을 늘리는 자리와 확장자를 정하는 자리가 한 곳이라 어긋날 수 없다.
 */
const COMMUNITY_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/** 미션(3MB)보다 큰 이유는 글 이미지가 본문 폭 전체를 쓰기 때문이다. D 요청값. */
const COMMUNITY_MAX_SIZE = 5 * 1024 * 1024

/** 키 첫 세그먼트. 용도 판정이 문자열 비교 한 번으로 끝나도록 상수로 내보낸다. */
export const COMMUNITY_PREFIX = "community/"

/** 미션 쪽과 같은 5분. 브라우저가 발급 직후 PUT 하나만 보내는 흐름이라 더 길 이유가 없다. */
const EXPIRES_IN = 300

/**
 * 호출부가 문자열 매칭 없이 응답을 만들 수 있게 코드와 상태를 함께 던진다.
 * (미션 라우트는 `err.message.includes("허용되지 않은")`으로 갈랐고, 메시지를 다듬으면
 * 조용히 500이 되는 구조다. 새 경로는 그 형태를 물려받지 않는다.)
 */
export class UploadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = "UploadError"
  }
}

export type CommunityPresignResult = {
  uploadUrl: string
  s3Key: string
  expiresIn: number
}

/**
 * 커뮤니티 글 이미지용 presigned PUT URL. 키는 `community/{userId}/{랜덤}.{ext}`다.
 *
 * **여기의 fileSize 검사는 권고다.** presigned PUT은 실제 업로드 크기를 강제하지 못한다
 * (강제하려면 서명에 Content-Length를 박아야 하고, 브라우저가 보내는 값과 1바이트라도
 * 어긋나면 디버깅이 어려운 403이 된다). 실제 상한은 업로드 뒤 `verifyCommunityObject()`가
 * HeadObject로 확인한다 — 미션이 `verifyS3Object()`로 하는 것과 같은 방식이다.
 */
export async function generateCommunityPresignedUrl(params: {
  userId: string
  contentType: string
  fileSize: number
}): Promise<CommunityPresignResult> {
  const { userId, contentType, fileSize } = params

  // 설정 오류가 먼저다. 버킷이 없으면 어떤 요청도 성공할 수 없어서, 파일 트집을 먼저 잡으면
  // 원인을 엉뚱한 곳에서 찾게 된다.
  const bucketName = bucket()

  const ext = COMMUNITY_EXT[contentType]
  if (!ext) {
    throw new UploadError("INVALID_FILE", "JPG·PNG·WEBP 이미지만 올릴 수 있습니다")
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new UploadError("INVALID_FILE", "파일 크기를 확인할 수 없습니다")
  }

  if (fileSize > COMMUNITY_MAX_SIZE) {
    throw new UploadError("INVALID_FILE", "파일 크기는 5MB 이하여야 합니다")
  }

  const s3Key = `${COMMUNITY_PREFIX}${userId}/${randomBytes(8).toString("hex")}.${ext}`

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucketName, Key: s3Key, ContentType: contentType }),
    { expiresIn: EXPIRES_IN },
  )

  return { uploadUrl, s3Key, expiresIn: EXPIRES_IN }
}

/**
 * 이 키가 이 사용자의 커뮤니티 키인가. S3를 부르지 않는다.
 *
 * `Post.imageKey`를 저장하는 쪽에서 **반드시** 통과시켜야 한다. 클라이언트가 보낸 키를 그대로
 * 저장하면 남의 `community/{남의 id}/…`나 `missions/{남의 id}/…`(미션 사진!)를 자기 글 이미지로
 * 걸 수 있다. 발급한 키는 세그먼트가 정확히 3개이므로 그 형태까지 본다.
 */
export function isOwnCommunityKey(s3Key: unknown, userId: string): s3Key is string {
  if (typeof s3Key !== "string") return false
  const prefix = `${COMMUNITY_PREFIX}${userId}/`
  if (!s3Key.startsWith(prefix)) return false
  const rest = s3Key.slice(prefix.length)
  return rest.length > 0 && !rest.includes("/")
}

/**
 * 업로드된 객체의 존재·타입·크기 확인. `Post` 저장 전에 부른다.
 * 소유권은 `isOwnCommunityKey()`로 먼저 걸러 HeadObject 호출 자체를 아낀다.
 */
export async function verifyCommunityObject(params: {
  s3Key: string
  userId: string
}): Promise<{ contentType: string; contentLength: number }> {
  const { s3Key, userId } = params

  const bucketName = bucket()

  if (!isOwnCommunityKey(s3Key, userId)) {
    throw new UploadError("INVALID_FILE", "잘못된 이미지입니다")
  }

  let result
  try {
    result = await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: s3Key }))
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "NotFound") {
      throw new UploadError("INVALID_FILE", "업로드된 사진을 찾을 수 없습니다")
    }
    throw err
  }

  if (!result.ContentType || !(result.ContentType in COMMUNITY_EXT)) {
    throw new UploadError("INVALID_FILE", "JPG·PNG·WEBP 이미지만 올릴 수 있습니다")
  }

  if (!result.ContentLength || result.ContentLength > COMMUNITY_MAX_SIZE) {
    throw new UploadError("INVALID_FILE", "파일 크기는 5MB 이하여야 합니다")
  }

  return { contentType: result.ContentType, contentLength: result.ContentLength }
}
