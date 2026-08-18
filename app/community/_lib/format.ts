/** 게시글 목록·상세에 쓰는 날짜 표시. "방금 전" 같은 상대 시각은 쓰지 않는다(고정 20개라 신선도 표시가 필요 없다). */
export function formatPostDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
