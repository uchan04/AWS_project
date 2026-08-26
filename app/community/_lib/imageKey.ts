import { IMAGE_KEY_MAX } from "./limits"

/**
 * 첨부 사진의 S3 키가 **이 사용자의 것인지** 판정한다.
 *
 * 원래는 `lib/uploads.ts`의 `isOwnCommunityKey()`(E)를 쓰기로 했으나 그 파일이 레포에 없다
 * (2026-08-25 확인: 어느 브랜치·히스토리에도 없고, 존재하는 presign은 `app/api/upload/presign`
 * 하나뿐인데 `missionId`와 `requiresPhoto` 미션을 강제해 커뮤니티에 쓸 수 없다).
 * `app/api/upload/`는 수정 금지 영역이라 판정만 커뮤니티 쪽에 둔다.
 *
 * **이 검사가 없으면 무슨 일이 생기는가**: `POST /api/community/posts`는 본문의 `imageKey`를
 * 그대로 저장하고, 목록·상세는 그 값을 `cdnUrl()`에 넣어 그린다. 그래서 클라이언트가 본문에
 * `missions/<남의 userId>/....jpg`를 직접 넣어 보내면 **남이 올린 미션 사진이 자기 글의
 * 이미지로 커뮤니티에 걸린다.** 글을 쓰는 것 말고는 아무 권한도 필요 없다.
 *
 * 그래서 "presign이 발급한 값"이라고 가정하지 않는다. 신뢰 경계는 여기다.
 *
 * 통과 조건은 `community/<본인 userId>/<파일명>` 정확히 세 조각이다.
 * - 접두사가 `community/`가 아니면 거절 → `missions/…`·`pets/…` 같은 남의 네임스페이스를 막는다
 * - 두 번째 조각이 본인 `User.id`(cuid, 슬래시 없음)와 **정확히** 같아야 한다 → 남의 칸을 막는다
 * - 조각이 정확히 3개여야 한다 → `community/<나>/../../missions/<남>/x.jpg` 같은 상위 이동을 막는다
 * - 확장자는 아래 3종뿐이다 → CloudFront가 `.html`·`.svg`를 원본 그대로 내려주면 그 도메인에서
 *   스크립트가 도는 XSS가 된다. 표시 경로가 `<img>`라 해도 URL은 직접 열 수 있다
 */
export const COMMUNITY_IMAGE_PREFIX = "community"

/**
 * 허용 확장자. 첨부 화면이 받기로 한 `image/jpeg`·`image/png`·`image/webp`에 대응한다
 * (`.jpg`는 `image/jpeg`의 흔한 표기라 함께 받는다).
 *
 * 커뮤니티 presign이 생기면 **그쪽이 정본이다.** 발급 규칙이 이 목록과 어긋나면 정상 업로드가
 * 여기서 400으로 떨어지므로, 그때 고칠 곳은 이 상수 하나다.
 */
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]

/** presign이 생기면 발급할 키의 접두사. 판정과 발급이 같은 값을 읽게 하려고 내보낸다. */
export function communityImageKeyPrefix(userId: string): string {
  return `${COMMUNITY_IMAGE_PREFIX}/${userId}/`
}

export function isOwnCommunityKey(key: string, userId: string): boolean {
  // userId가 비면 어떤 키도 통과시키지 않는다. 빈 문자열끼리 같다고 판정되면
  // 인증이 깨진 경로에서 모든 키가 열린다
  if (!userId) return false
  if (!key || key.length > IMAGE_KEY_MAX) return false

  const segments = key.split("/")
  if (segments.length !== 3) return false

  const [prefix, owner, filename] = segments
  if (prefix !== COMMUNITY_IMAGE_PREFIX) return false
  if (owner !== userId) return false

  // 슬래시·공백·퍼센트 인코딩을 파일명에서 배제한다. 남는 것은 presign이 만들 이름뿐이다
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return false
  if (filename.startsWith(".")) return false

  const dot = filename.lastIndexOf(".")
  if (dot <= 0) return false
  return ALLOWED_EXTENSIONS.includes(filename.slice(dot + 1).toLowerCase())
}
