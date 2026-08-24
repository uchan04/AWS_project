import { CRISIS_HOTLINE, CRISIS_HOTLINE_LABEL } from "@/lib/safety"

/**
 * 위기 안내 카드. 챗봇·글쓰기·댓글 세 곳이 같은 모양을 쓴다.
 *
 * 색: 빨강을 쓰지 않는다. 빨강은 "잘못됨"으로 읽히고 이 카드는 사용자를 경고하는 것이
 * 아니다. 호박색은 눈에 들어오면서 비난처럼 읽히지 않는다.
 *
 * 번호는 하나만 둔다(`lib/safety.ts`). 위기 상황에서 선택지 나열은 부담이다.
 * `tel:` 링크로 감싼다 — 번호를 외워 전화 앱으로 옮겨 적게 하지 않는다.
 *
 * `aria-live`를 걸지 않는다. 이 카드가 뜨는 자리에는 같은 안내가 이미 본문(챗봇 응답
 * 또는 서버 메시지)에 들어 있고, 그쪽이 읽힌다. 둘 다 걸면 두 번 읽는다.
 */
export function CrisisNotice({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div role="note" className={`rounded-xl border border-amber-200 bg-amber-50 p-4 ${className}`}>
      <p className="text-xs leading-relaxed text-amber-900">{message}</p>
      {/* bg-amber-800은 흰 글자와 4.5:1을 넘긴다. amber-600으로 낮추지 말 것 */}
      <a
        href={`tel:${CRISIS_HOTLINE}`}
        className="mt-2.5 flex items-center justify-center rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {CRISIS_HOTLINE_LABEL} {CRISIS_HOTLINE} 전화하기
      </a>
    </div>
  )
}
