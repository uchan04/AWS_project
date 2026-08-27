"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { communityHref, parseSearchQuery, SEARCH_QUERY_MAX } from "../_lib/queryLink"

/**
 * 갤러리 안에서 글을 찾는다. 제목과 본문만 본다 — 닉네임·작성자로는 찾지 않는다.
 * 여기는 익명에 가깝게 쓰는 공간이라 "누가 썼는지로 찾는 길"을 열면 성격이 달라진다.
 *
 * **검색어는 URL이 들고 있다.** 이 컴포넌트의 useState는 입력 중인 글자일 뿐이고,
 * 확정된 상태는 언제나 `?q=`다. 그래서 새로고침·뒤로가기·주소 공유가 전부 그대로 동작한다.
 *
 * **useSearchParams를 쓰지 않는다.** 서버(page.tsx)가 이미 파싱한 값을 prop으로 내려주므로
 * 같은 값을 클라이언트에서 다시 읽을 이유가 없다. 훅을 쓰면 Suspense 경계까지 따라붙는다.
 *
 * **디바운스 검색을 넣지 마라.** 글자마다 요청을 보내면 RDS가 us-east-1이라 한 글자에
 * 500ms짜리 왕복이 붙는다(docs/dev/perf.md). 제출할 때만 이동한다.
 */
export function SearchBar({ tab, defaultQuery }: { tab?: string; defaultQuery: string }) {
  const router = useRouter()
  const [value, setValue] = useState(defaultQuery)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    /*
     * **page를 넣지 않는다. 새 검색은 항상 1페이지다.**
     * 3페이지를 보다가 검색하면 결과가 3페이지어치 없을 때 빈 화면이 뜬다 —
     * 검색이 실패한 것처럼 보이지만 실제로는 있는 결과를 지나쳐 온 것이다.
     */
    router.push(communityHref({ tab, q: parseSearchQuery(value) }))
  }

  function clear() {
    setValue("")
    // 탭은 유지하고 검색만 버린다. page도 함께 버려진다(1페이지로 돌아간다).
    router.push(communityHref({ tab }))
  }

  /*
   * 폭은 max-w-lg(32rem)까지만 늘린다. 입력이 50자 제한(SEARCH_QUERY_MAX)이라
   * 콘텐츠 폭(max-w-5xl)을 다 쓰면 절반이 늘 비어 보인다 — 박스 크기가 "이만큼 쓰라"는
   * 신호로 읽히므로 실제로 쓸 수 있는 길이에 맞춘다.
   *
   * **w-full을 빼지 마라.** 좁은 화면에서는 max-w-lg에 닿지 않으므로 폭을 다 써야 한다.
   * **mx-auto를 붙이지 마라.** 위 탭 줄(GalleryTabs)과 왼쪽 끝이 맞아야 한다 —
   * 가운데로 밀면 탭·검색·목록의 왼쪽 기준선이 하나 어긋난다.
   */
  return (
    <form role="search" onSubmit={submit} className="group relative w-full max-w-lg">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={SEARCH_QUERY_MAX}
        aria-label="글 검색"
        placeholder="제목이나 내용으로 찾아보세요"
        className={
          // 우측 padding은 버튼이 차지하는 만큼이다. ×까지 있으면 40+4+40+4=88px이라 pr-24(96px),
          // 돋보기만 있으면 44px이라 pr-11. 이 값이 모자라면 긴 검색어가 버튼 아래로 파고든다.
          "w-full rounded-xl border border-rule bg-paper py-2.5 pl-4 text-sm text-ink placeholder:text-muted outline-none focus:border-rule-2 " +
          (value ? "pr-24" : "pr-11")
        }
      />

      {/*
       * 두 버튼을 **오른쪽 끝에 붙인 한 줄**에 담는다. 이렇게 두면 ×가 생기고 사라져도
       * 돋보기는 제자리에 있다 — 각각 absolute로 두면 ×의 유무에 따라 돋보기가 좌우로 튄다.
       * 순서는 안쪽부터 × , 가장 오른쪽이 돋보기다. gap-1은 두 버튼을 붙여두지 않기 위한
       * 최소 간격이고, 여기가 좁으면 지우려다 검색이 실행된다.
       *
       * 컨테이너는 pointer-events-none이다. 버튼 사이 빈 틈을 눌렀을 때 입력창 대신
       * 이 div가 클릭을 먹으면 포커스가 들어오지 않는다. 버튼만 auto로 되돌린다.
       */}
      <div className="pointer-events-none absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1">
        {/* 입력이 비어 있으면 지울 것이 없다. 자리만 차지하는 버튼은 두지 않는다.
            **type="button"이 필수다** — 폼 안 button의 기본값은 submit이라, 빼면
            지우기와 제출이 한 번에 일어나 방금 지운 검색어로 이동한다 */}
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="검색어 지우기"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg text-muted transition duration-150 hover:text-ink-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            ×
          </button>
        )}

        {/*
         * 돋보기가 곧 제출 버튼이다. **장식용 span/div로 두지 마라** — 검색창 안의 돋보기는
         * 누를 수 있는 것으로 읽히는데 아무 일도 일어나지 않으면 검색이 고장 난 것으로 보인다.
         *
         * h-10 w-10(40x40)은 손가락 탭 영역이고 아이콘 자체는 18px다. 둘을 같은 크기로 두면
         * 정확히 겨냥해야만 눌린다.
         */}
        <button
          type="submit"
          aria-label="검색"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg text-muted transition duration-150 group-focus-within:text-ink hover:text-ink-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          {/* 인라인 SVG다. 아이콘 하나 때문에 라이브러리를 늘리지 않는다.
              stroke=currentColor라 위 text-muted/text-ink를 그대로 따른다 */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[18px] w-[18px]"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5 21 21" />
          </svg>
        </button>
      </div>
    </form>
  )
}
