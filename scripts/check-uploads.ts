// 커뮤니티 글 이미지 업로드 경로의 불변식 검사(E, 2026-08-24).
// 미션 사진(3MB·jpg·png)과 상한이 다른 두 번째 경로가 생겼으므로, 두 상한이 조용히 한 벌로
// 합쳐지거나 키 prefix가 어긋나는 것을 여기서 막는다.
//
//   npm run check:uploads
//
// S3에 붙지 않는다. presigned URL 서명은 로컬 계산이고, AWS 자격증명이 없는 환경에서는
// 발급 검사만 건너뛴다(키 규칙·상한 검사는 그대로 돈다).
//
// 비동기 단정을 main()에 모아 둔 것은 tsx가 CJS로 트랜스파일해 top-level await를 못 쓰기
// 때문이다(scripts/e2e-scenario.ts와 같은 형태다).

import assert from "node:assert/strict"
import {
  COMMUNITY_PREFIX,
  UploadError,
  generateCommunityPresignedUrl,
  isOwnCommunityKey,
} from "@/lib/uploads"
import { generatePresignedUrl as generateMissionPresignedUrl } from "@/lib/missions/upload"

// 로컬 .env의 S3_BUCKET이 비어 있어도 이 검사는 돈다. `lib/uploads.ts`가 버킷을 부를 때마다
// 읽기 때문에 여기서 채워도 늦지 않다. 공개 값이며(CloudFront origin과 같은 버킷) 배포는
// Amplify 환경변수를 쓴다.
process.env.S3_BUCKET ||= "welli-uploads-185236887369"

const USER = "user-abc"
const OTHER = "user-xyz"
const MB = 1024 * 1024

// --- 키 소유권 -------------------------------------------------------------

assert.equal(isOwnCommunityKey(`${COMMUNITY_PREFIX}${USER}/deadbeef.jpg`, USER), true, "자기 키는 통과한다")
assert.equal(
  isOwnCommunityKey(`${COMMUNITY_PREFIX}${OTHER}/deadbeef.jpg`, USER),
  false,
  "남의 커뮤니티 키는 막는다",
)
assert.equal(
  isOwnCommunityKey(`missions/${USER}/m1/deadbeef.jpg`, USER),
  false,
  "미션 사진 키를 글 이미지로 걸 수 없다 — 사적인 사진이다",
)
assert.equal(
  isOwnCommunityKey(`${COMMUNITY_PREFIX}${USER}/sub/deadbeef.jpg`, USER),
  false,
  "발급하지 않는 형태(세그먼트 4개)는 막는다",
)
assert.equal(isOwnCommunityKey(`${COMMUNITY_PREFIX}${USER}/`, USER), false, "빈 파일명은 막는다")
assert.equal(isOwnCommunityKey(undefined, USER), false, "문자열이 아니면 막는다")
assert.equal(isOwnCommunityKey(null, USER), false, "null도 막는다")

async function main() {
  // --- 커뮤니티 상한 -------------------------------------------------------

  await assert.rejects(
    () => generateCommunityPresignedUrl({ userId: USER, contentType: "image/gif", fileSize: MB }),
    (err: unknown) => err instanceof UploadError && /JPG·PNG·WEBP/.test(err.message),
    "gif는 막는다",
  )
  await assert.rejects(
    () => generateCommunityPresignedUrl({ userId: USER, contentType: "image/jpeg", fileSize: 6 * MB }),
    (err: unknown) => err instanceof UploadError && /5MB/.test(err.message),
    "5MB 초과는 막는다",
  )
  await assert.rejects(
    () => generateCommunityPresignedUrl({ userId: USER, contentType: "image/jpeg", fileSize: 0 }),
    (err: unknown) => err instanceof UploadError,
    "크기 0은 막는다",
  )

  // --- 미션 상한은 그대로여야 한다 -----------------------------------------
  // 커뮤니티에 맞춰 미션 쪽 상수를 올리면 `verifyS3Object()`까지 느슨해진다. 그 변경은 여기서
  // 실패한다 (미션 사진은 비전 모델에 그대로 넘어가는 입력이다 — lib/missions/vision.ts).

  await assert.rejects(
    () =>
      generateMissionPresignedUrl({
        userId: USER,
        missionId: "m1",
        contentType: "image/webp",
        fileSize: MB,
      }),
    /허용되지 않은 파일 형식/,
    "미션은 여전히 webp를 받지 않는다",
  )
  await assert.rejects(
    () =>
      generateMissionPresignedUrl({
        userId: USER,
        missionId: "m1",
        contentType: "image/jpeg",
        fileSize: 4 * MB,
      }),
    /3MB/,
    "미션 상한은 여전히 3MB다",
  )

  // --- 발급되는 키의 모양 --------------------------------------------------

  // 자격증명이 없으면 서명 단계에서 죽는다. 그때는 위 검사까지만 하고 통과시킨다 — CI 없이
  // 각자 로컬에서 도는 스크립트라 자격증명 유무로 실패시키면 아무도 안 돌린다.
  let signed: Awaited<ReturnType<typeof generateCommunityPresignedUrl>> | null = null
  try {
    signed = await generateCommunityPresignedUrl({
      userId: USER,
      contentType: "image/webp",
      fileSize: 4 * MB,
    })
  } catch (err) {
    if (err instanceof UploadError) throw err
    console.log("· AWS 자격증명이 없어 발급 검사는 건너뜀:", (err as Error).message)
  }

  if (signed) {
    assert.match(
      signed.s3Key,
      new RegExp(`^${COMMUNITY_PREFIX}${USER}/[0-9a-f]{16}\\.webp$`),
      "webp는 .webp 키로 나간다 — 미션 쪽 삼항(jpeg?jpg:png)이 복사되지 않았다",
    )
    assert.equal(isOwnCommunityKey(signed.s3Key, USER), true, "발급한 키는 소유권 검사를 통과한다")
    assert.equal(signed.expiresIn, 300, "유효 시간은 5분이다")
    assert.ok(signed.uploadUrl.includes("X-Amz-Signature="), "서명된 PUT URL이다")
    assert.ok(signed.uploadUrl.includes(`/${COMMUNITY_PREFIX}`), "URL 경로에 community/ prefix가 들어간다")
  }

  console.log("check:uploads 통과")
}

void main()
