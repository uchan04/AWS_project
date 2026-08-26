/**
 * 글·댓글 길이 상한. 서버 라우트와 입력 화면이 **같은 값**을 읽어야 한다 —
 * 화면에만 넣으면 API를 직접 부르는 쪽이 무제한이고, 서버에만 넣으면
 * 사용자가 다 쓴 뒤에 400을 맞는다.
 *
 * `Post.title`·`Post.body`·`Comment.body`는 스키마에서 Postgres `text`(무제한)다.
 * DB에 상한을 두려면 마이그레이션이 필요해서 애플리케이션 층에서 막는다.
 */

/** 제목. 목록 카드가 두 줄로 자르는 길이에 맞췄다 */
export const TITLE_MAX = 100

/** 본문. 일기 한 편 정도. 이보다 길면 목록 응답 크기가 사람 수에 비례해 커진다 */
export const BODY_MAX = 2000

/** 댓글. 상세 화면에서 접기 없이 읽히는 길이 */
export const COMMENT_MAX = 500

/**
 * 첨부 사진의 S3 키 길이 상한.
 *
 * 여기서 막는 것은 길이뿐이다 — 무제한이면 API를 직접 부르는 쪽이 목록 응답에
 * 임의 길이 문자열을 실을 수 있다.
 *
 * **형식과 소유 판정은 `_lib/imageKey.ts`의 `isAttachableImageKey()`가 한다**(소유권은 그 함수가 `lib/uploads.ts`에 위임한다). 전에 이 자리에
 * "키 형식은 검사하지 않는다(presign이 만든 값이므로)"고 적혀 있었으나 그것은 틀렸다 —
 * 이 값은 presign이 아니라 **요청 본문**에서 온다. 근거는 그 파일 주석에 있다.
 */
export const IMAGE_KEY_MAX = 500

/**
 * 화면에서 "남은 글자"를 띄울 때 쓴다. 상한을 넘으면 음수가 되므로
 * 그대로 빨간색 조건으로 쓸 수 있다.
 */
export function remaining(text: string, max: number): number {
  return max - text.length
}
