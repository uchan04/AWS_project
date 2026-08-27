import type { TypeCode } from "@prisma/client"
import { TRIBE, authorLabel } from "@/lib/types"

/**
 * 커뮤니티의 작성자 표기. 관리자면 종족 대신 "관리자"로 보인다.
 *
 * **`lib/types.ts`의 `authorLabel()`을 고치지 않는다.** E 소유이고 진단·미션 화면도 그
 * 함수를 쓴다 — 거기서 종족 표기를 바꾸면 커뮤니티와 무관한 화면까지 따라 바뀐다.
 * 그래서 감싸기만 한다. 관리자가 아니면 그 함수를 그대로 부른다.
 *
 * ── 이 표시는 **지금 상태**를 보여준다. 글에 박히지 않는다 ────────────────────
 *
 * `isAdmin`은 `User`의 컬럼이고 `Post`에는 없다. 그래서 나중에 관리자 권한을 끄면
 * **그 사람의 과거 글이 전부 종족 표시로 되돌아간다.** 반대도 같다 — 오늘 권한을 주면
 * 예전에 쓴 글까지 소급해서 "관리자"로 보인다.
 *
 * 글의 종족 표시가 `Post.galleryType`을 정본으로 쓰는 것과는 **성질이 다르다.** 그쪽은
 * 재진단으로 종족이 바뀌어도 글이 이동하지 않게 작성 시점을 붙들어 둔 것이고(스키마 주석),
 * 이쪽은 붙들지 않는다. 관리자 표시는 "이 글을 쓸 때 관리자였다"가 아니라
 * "이 사람이 지금 관리자다"라는 뜻이다.
 *
 * 소급되면 안 되는 표시가 필요해지면 `Post`에 컬럼을 두어야 하고, 그건 스키마 변경이다.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** 화면에 쓰는 관리자 표기. 한 곳에서만 정한다 */
export const ADMIN_LABEL = "관리자"

/**
 * 관리자 배지 색. 종족색을 쓰지 않는다 — 종족이 아니라 역할이라서, 어느 종족색을 빌려도
 * 그 종족처럼 읽힌다. 중립 회색(neutral-600)으로 둔다.
 */
const ADMIN_COLOR = "#525252"

export type CommunityAuthor = {
  nickname: string
  typeCode: TypeCode | null
  isAdmin: boolean
}

/** 이름 줄. "부지런한 곰 · 곰" 또는 "부지런한 곰 · 관리자" */
export function communityAuthorLabel(user: CommunityAuthor): string {
  if (user.isAdmin) return `${user.nickname} · ${ADMIN_LABEL}`
  return user.typeCode ? authorLabel(user.nickname, user.typeCode) : user.nickname
}

/**
 * 이름 옆 배지. **이름 줄과 같은 기준으로 갈린다** — 이름은 "관리자"인데 배지는 "곰"이면
 * 어긋난다. 진단 전이고 관리자도 아니면 null이라 호출부가 배지를 그리지 않는다.
 */
export function communityAuthorBadge(user: CommunityAuthor): { text: string; colorHex: string } | null {
  if (user.isAdmin) return { text: ADMIN_LABEL, colorHex: ADMIN_COLOR }
  if (!user.typeCode) return null
  return { text: TRIBE[user.typeCode].animal, colorHex: TRIBE[user.typeCode].colorHex }
}
