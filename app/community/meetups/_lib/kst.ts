const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 어떤 시각이 속한 "KST 달력 날짜"의 범위를 [start, end) UTC 구간으로 준다.
 *
 * UTC 자정으로 자르면 안 된다. KST는 UTC+9라서 한국 시간 8월 30일 오전 3시는
 * UTC로 8월 29일 18시다. UTC 날짜를 그대로 쓰면 이 모임이 8월 29일로 분류되어,
 * 같은 8월 30일 저녁 모임과 "같은 날"로 잡히지 않는다.
 * 한국 시간 오전 0~9시에 시작하는 모임이 전부 전날로 밀리는 셈이다.
 *
 * 그래서 +9시간을 더해 KST 벽시계 값을 UTC 필드에 담은 뒤 그 날짜를 취하고,
 * 다시 -9시간 해서 실제 UTC 경계로 되돌린다. 이 서비스는 한국 사용자만 쓰므로
 * 시간대를 KST 하나로 고정해도 된다(화면의 meetupDateTime()도 같은 전제다).
 */
export function kstDayRange(at: Date): { start: Date; end: Date } {
  const shifted = new Date(at.getTime() + KST_OFFSET_MS)
  const dayStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
  const start = new Date(dayStart - KST_OFFSET_MS)
  return { start, end: new Date(start.getTime() + DAY_MS) }
}
