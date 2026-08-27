/**
 * 이 파일은 prisma 를 import 하지 않는다. SearchBar 가 클라이언트 컴포넌트라
 * gallery.ts(prisma import)에서 링크 헬퍼를 가져오면 서버 코드가 클라이언트
 * 번들에 섞인다. 링크 조립과 파라미터 파싱만 이쪽에 둔다.
 */

/**
 * 한 페이지에 그리는 글 수. **여기가 유일한 정의다** — 전에는 gallery.ts의 모듈 지역
 * 상수(20)였는데, 페이지 수 계산이 목록 조회 바깥(Pagination·라우트 응답)까지 나가면서
 * prisma를 모르는 쪽에서도 같은 값이 필요해졌다. 두 곳에 두면 한쪽만 고쳐졌을 때
 * "마지막 페이지가 비어 있는" 형태로 조용히 어긋난다.
 */
export const POST_LIST_LIMIT = 12

/** 검색어 상한. 화면(maxLength)과 파서가 같은 값을 봐야 해서 여기서 한 번만 정한다 */
export const SEARCH_QUERY_MAX = 50

/**
 * 검색어를 다듬는다. 화면 입력과 URL 파라미터가 **같은 함수**를 통과해야
 * "주소창에 친 검색"과 "입력창에 친 검색"의 결과가 갈리지 않는다.
 *
 * 빈 문자열이 "검색 안 함"이다. null/undefined를 따로 쓰지 않는다 — 호출부가
 * 두 가지 빈 값을 구분해야 하면 조건문이 곧 어긋난다.
 */
export function parseSearchQuery(raw: string | undefined): string {
  if (typeof raw !== "string") return ""
  // 연속 공백을 1칸으로 줄인 뒤 자른다. 자른 자리가 공백이면 다시 떼어낸다 —
  // 끝에 공백이 남으면 contains 검색이 그 공백까지 찾는다.
  return raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_QUERY_MAX).trim()
}

/**
 * page 파라미터. 정수로 읽히지 않거나 1 미만이면 1이다.
 *
 * **자릿수를 6자리로 제한한다.** 이 값이 그대로 `skip`이 되는데, Prisma의 skip은 Int라
 * `?page=99999999999`처럼 손으로 친 주소가 500이 된다. 6자리면 12만 페이지까지라
 * 정상 사용자는 닿지 않고, 넘어가면 잘못된 입력으로 보고 1로 떨어뜨린다.
 */
export function parsePageParam(raw: string | undefined): number {
  if (typeof raw !== "string") return 1
  const trimmed = raw.trim()
  if (!/^\d{1,6}$/.test(trimmed)) return 1
  const page = Number.parseInt(trimmed, 10)
  return page >= 1 ? page : 1
}

/**
 * 커뮤니티 목록 주소를 만든다. **링크 조립은 이 함수 하나만 쓴다** — SearchBar와
 * Pagination이 각자 문자열을 이어붙이면 한쪽만 tab을 빠뜨리는 식으로 곧 어긋난다.
 *
 * 기본값은 주소에 넣지 않는다(빈 검색어, 1페이지). 1페이지 주소가 `/community?page=1`이면
 * 같은 화면에 주소가 두 개 생기고, 탭 링크(`/community`)와 눈으로 비교되지 않는다.
 */
export function communityHref(opts: { tab?: string; q?: string; page?: number }): string {
  const params = new URLSearchParams()
  if (opts.tab) params.set("tab", opts.tab)
  if (opts.q) params.set("q", opts.q)
  if (opts.page && opts.page > 1) params.set("page", String(opts.page))

  const query = params.toString()
  return query ? `/community?${query}` : "/community"
}
