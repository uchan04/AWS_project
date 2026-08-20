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
