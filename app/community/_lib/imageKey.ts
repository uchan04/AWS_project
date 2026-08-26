import { isOwnCommunityKey } from "@/lib/uploads"

/**
 * 첨부 사진의 S3 키가 **이 사용자의 것이고, 글에 걸어도 되는 형식인지** 판정한다.
 *
 * 두 층으로 나뉜다.
 *
 * 1. **소유권 — `lib/uploads.ts`의 `isOwnCommunityKey()`(E)에 위임한다.**
 *    2026-08-26에 갈아탔다. 그전에는 같은 판정을 이 파일이 직접 구현했는데, 키를 발급하는
 *    쪽(`generateCommunityPresignedUrl()`)과 검사하는 쪽이 서로 다른 규칙을 들고 있으면
 *    **한쪽만 고쳐지는 날이 온다.** 발급 규칙이 정본이므로 판정도 그 파일에서 온다.
 *    (E의 주석이 두 파일의 불변식을 적어 뒀다 — 키는 서버가 정하고, 첫 세그먼트가 용도를
 *    가르고, 두 번째 세그먼트가 항상 userId다.)
 *
 * 2. **확장자 — 그 층만 여기 남는다.** E의 함수는 `community/{userId}/{파일명}` 세 조각인지만
 *    보고 확장자를 따지지 않는다. 발급 경로만 보면 그것으로 충분하지만, 이 값은 발급이 아니라
 *    **요청 본문**에서 온다.
 *
 * **확장자를 막는 이유**: CloudFront가 `.html`·`.svg`를 원본 그대로 내려주면 그 도메인에서
 * 스크립트가 도는 XSS가 된다. 표시 경로가 `<img>`라 해도 URL은 직접 열 수 있다.
 * 버킷이 CloudFront origin이고 `/*` 전체가 공개라(`lib/uploads.ts` 머리 주석) 더 그렇다.
 * 이 목록을 넓히지 마라.
 */

/**
 * 허용 확장자. `.jpg`는 `image/jpeg`의 흔한 표기라 함께 받는다 — 실제 발급값도 `jpg`다
 * (`lib/uploads.ts`의 `COMMUNITY_EXT`).
 *
 * **webp를 뺐다(2026-08-26).** Bedrock Guardrails가 판정하는 이미지 포맷이 PNG·JPEG
 * 둘뿐이라(`GuardrailImageFormat`), webp는 `_lib/imageModeration.ts`가 어차피 차단한다.
 * 이 층이 판정 층보다 느슨하면 백스톱 역할을 못 한다.
 */
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"]

function hasAllowedExtension(key: string): boolean {
  const dot = key.lastIndexOf(".")
  // 점이 없거나 경로 구분자 뒤 첫 글자면 확장자가 아니다
  if (dot <= 0 || dot === key.length - 1) return false
  return ALLOWED_EXTENSIONS.includes(key.slice(dot + 1).toLowerCase())
}

/**
 * `Post.imageKey`로 저장해도 되는 값인지. **저장 전에 반드시 통과시킨다.**
 *
 * 빠뜨리면 클라이언트가 본문에 `missions/<남의 userId>/….jpg`를 직접 넣어 남이 올린 미션
 * 사진을 자기 글 이미지로 걸 수 있다. 글을 쓰는 것 말고는 아무 권한도 필요 없다.
 */
export function isAttachableImageKey(key: unknown, userId: string): key is string {
  return isOwnCommunityKey(key, userId) && hasAllowedExtension(key)
}
