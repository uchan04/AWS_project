const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** 게시글 카드용 상대 시각 표기. */
export function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  if (diff < MINUTE) return "방금"
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`
  return `${Math.floor(diff / DAY)}일 전`
}

/**
 * 오프라인 모임 카드용 절대 일시. 상대 시각(timeAgo)은 미래 일정에 쓸 수 없다.
 * 시간대를 KST로 고정한다 — 서버(UTC)와 브라우저(KST)가 서로 다른 문자열을 만들면
 * 하이드레이션에서 어긋난다. 표기할 일시는 항상 한국 기준이라 고정해도 문제가 없다.
 */
const MEETUP_DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
})

export function meetupDateTime(date: Date): string {
  return MEETUP_DATE_TIME.format(date)
}
