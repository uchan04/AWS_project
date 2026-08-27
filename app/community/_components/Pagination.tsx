import Link from "next/link"
import { communityHref } from "../_lib/queryLink"

/**
 * 페이지 이동. **"use client"가 없다** — `<Link>`만 쓰는 서버 컴포넌트다.
 * 상태가 URL에 있으므로 클릭을 가로챌 것이 없고, 클라이언트 경계를 만들면 번들만 늘어난다.
 *
 * href는 전부 `communityHref()`가 만든다. 여기서 문자열을 이어붙이면 tab을 빠뜨리는
 * 순간 탭 밖으로 튕긴다(_lib/queryLink.ts 주석).
 *
 * **갈 수 없는 곳은 링크로 만들지 않는다.** 현재 페이지와 양 끝의 이전/다음은 `<span>`이다.
 * 눌리는 척하는 링크는 스크린 리더에서 이동 지점으로 읽히고, 마우스로는 눌러도 아무 일이
 * 없어 고장으로 보인다.
 */

/** 현재 페이지 앞뒤로 보여줄 번호 수. 관리자 탭이 4개라 좁은 화면 여유가 크지 않다 */
const RANGE = 2

export function Pagination({
  tab,
  query,
  page,
  totalPages,
}: {
  tab?: string
  query: string
  page: number
  totalPages: number
}) {
  // 한 페이지뿐이면 이동할 곳이 없다. 빈 줄을 남기지 않는다
  if (totalPages <= 1) return null

  const first = Math.max(1, page - RANGE)
  const last = Math.min(totalPages, page + RANGE)
  const numbers = Array.from({ length: last - first + 1 }, (_, index) => first + index)

  const ITEM_BASE =
    "flex h-10 min-w-10 items-center justify-center rounded-lg px-3 font-display text-base transition duration-150"
  const FOCUS_RING =
    " focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none"

  // 링크: 트랙 위 비활성 탭과 같은 결로 둔다(글자색 변화만, 그림자·이동 없음)
  const LINK = ITEM_BASE + " text-ink-2 hover:bg-paper-2" + FOCUS_RING
  // 현재 페이지: GalleryTabs의 활성 탭과 같은 흰 칸
  const CURRENT = ITEM_BASE + " bg-card text-ink shadow-sm"
  // 끝에 닿아 갈 수 없는 이전/다음
  const DISABLED = ITEM_BASE + " text-muted/50"

  return (
    <nav aria-label="페이지 이동" className="flex items-center justify-center gap-1 pt-2 pb-4">
      {page > 1 ? (
        <Link href={communityHref({ tab, q: query, page: page - 1 })} className={LINK}>
          이전
        </Link>
      ) : (
        <span className={DISABLED}>이전</span>
      )}

      {numbers.map((number) =>
        number === page ? (
          <span key={number} aria-current="page" className={CURRENT}>
            {number}
          </span>
        ) : (
          <Link key={number} href={communityHref({ tab, q: query, page: number })} className={LINK}>
            {number}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={communityHref({ tab, q: query, page: page + 1 })} className={LINK}>
          다음
        </Link>
      ) : (
        <span className={DISABLED}>다음</span>
      )}
    </nav>
  )
}
