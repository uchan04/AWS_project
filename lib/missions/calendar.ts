// 소유자: B. 출석 캘린더의 날짜 계산. 순수 함수만 둔다.
//
// prisma를 import하지 않는다 — 클라이언트 컴포넌트(AttendanceCalendar)와 서버 라우트가
// 같은 함수를 쓰기 때문이다. 계산이 두 곳에 흩어지면 구간 경계가 어긋난다.
// 검증: npm run check:attendance (scripts/check-attendance.ts)
//
// 날짜 기준은 Asia/Seoul이다. KST는 서머타임이 없어 항상 UTC+9이므로
// 오프셋을 상수로 써도 안전하다.

/** YYYY-MM-DD. 출석 판정·비교는 전부 이 문자열로 한다 */
export type DateKey = string
/** YYYY-MM */
export type MonthKey = string

/** 화면에 보이는 7일 구간. 1~7 / 8~14 / 15~21 / 22~28 / 29~말일 */
export type AttendanceWindow = {
  year: number
  /** 1~12 */
  month: number
  startDay: number
  endDay: number
  /** startDay~endDay의 날짜 키. 다음 달 날짜를 섞지 않으므로 길이가 7보다 짧을 수 있다 */
  dateKeys: DateKey[]
}

const KST_OFFSET = "+09:00"
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function dateKey(year: number, month: number, day: number): DateKey {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function monthKey(year: number, month: number): MonthKey {
  return `${year}-${pad2(month)}`
}

export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  if (m < 1 || m > 12) return false
  return d >= 1 && d <= lastDayOfMonth(y, m)
}

export function isValidMonthKey(value: string): boolean {
  return MONTH_KEY.test(value)
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number)
  return { year, month, day }
}

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number)
  return { year, month }
}

/** 그 달의 마지막 날. 윤년은 Date가 판단한다 */
export function lastDayOfMonth(year: number, month: number): number {
  // Date.UTC(y, month, 0) = 그 달의 말일 (month는 0-based라 +1달의 0일)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** n일 뒤(음수면 앞) 날짜 키. UTC 산술이라 브라우저 시간대에 영향받지 않는다 */
export function addDays(key: DateKey, n: number): DateKey {
  const { year, month, day } = parseDateKey(key)
  const d = new Date(Date.UTC(year, month - 1, day + n))
  return dateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** 0=일요일. 표시용 요일 */
export function weekdayOf(key: DateKey): number {
  const { year, month, day } = parseDateKey(key)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** 그 날짜가 속한 구간의 시작일. 29일 이후는 말일까지 한 구간이다 */
export function windowStartDay(day: number): number {
  if (day >= 29) return 29
  return Math.floor((day - 1) / 7) * 7 + 1
}

export function windowFromParts(year: number, month: number, startDay: number): AttendanceWindow {
  const last = lastDayOfMonth(year, month)
  const endDay = Math.min(startDay + 6, last)
  const dateKeys: DateKey[] = []
  for (let d = startDay; d <= endDay; d++) dateKeys.push(dateKey(year, month, d))
  return { year, month, startDay, endDay, dateKeys }
}

/** 그 날짜가 포함된 구간 */
export function windowFor(key: DateKey): AttendanceWindow {
  const { year, month, day } = parseDateKey(key)
  return windowFromParts(year, month, windowStartDay(day))
}

/** 다음 구간. 말일 구간이면 다음 달 1~7일 */
export function nextWindow(win: AttendanceWindow): AttendanceWindow {
  const last = lastDayOfMonth(win.year, win.month)
  if (win.endDay >= last) {
    const year = win.month === 12 ? win.year + 1 : win.year
    const month = win.month === 12 ? 1 : win.month + 1
    return windowFromParts(year, month, 1)
  }
  return windowFromParts(win.year, win.month, win.startDay + 7)
}

/** 이전 구간. 1일 구간이면 이전 달의 마지막 구간 */
export function prevWindow(win: AttendanceWindow): AttendanceWindow {
  if (win.startDay === 1) {
    const year = win.month === 1 ? win.year - 1 : win.year
    const month = win.month === 1 ? 12 : win.month - 1
    // 2월(28일)이면 마지막 구간이 22~28이고, 윤년(29일)이면 29~29다
    return windowFromParts(year, month, windowStartDay(lastDayOfMonth(year, month)))
  }
  return windowFromParts(win.year, win.month, win.startDay - 7)
}

export function windowMonthKey(win: AttendanceWindow): MonthKey {
  return monthKey(win.year, win.month)
}

export function sameWindow(a: AttendanceWindow, b: AttendanceWindow): boolean {
  return a.year === b.year && a.month === b.month && a.startDay === b.startDay
}

/**
 * 월간 달력 격자. 일요일 시작 7열, 월 시작 전·종료 후는 null(빈 칸)이다.
 * null 칸은 화면에서 클릭 불가·접근성 트리 제외로 처리한다.
 */
export function monthGrid(key: MonthKey): (DateKey | null)[][] {
  const { year, month } = parseMonthKey(key)
  const last = lastDayOfMonth(year, month)
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()

  const cells: (DateKey | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= last; d++) cells.push(dateKey(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (DateKey | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** "2026년 8월" */
export function formatMonthTitle(key: MonthKey): string {
  const { year, month } = parseMonthKey(key)
  return `${year}년 ${month}월`
}

/**
 * 기간 탐색 영역 가운데에 쓰는 라벨. "8월 22일–28일"
 * 올해가 아닐 때만 연도를 붙인다 — 대부분의 경우 연도는 잡음이다.
 */
export function formatWindowRange(win: AttendanceWindow, todayKey: DateKey): string {
  const prefix = win.year === parseDateKey(todayKey).year ? "" : `${win.year}년 `
  if (win.startDay === win.endDay) return `${prefix}${win.month}월 ${win.startDay}일`
  return `${prefix}${win.month}월 ${win.startDay}일–${win.endDay}일`
}

export type DayStatus =
  /** DB에 AttendanceClaim 행이 있다 */
  | "claimed"
  /** 오늘인데 아직 안 받았다. 유일하게 누를 수 있는 칸 */
  | "today"
  /** 지난 날인데 기록이 없다. 소급 수령은 없다 */
  | "missed"
  /** 아직 오지 않은 날 */
  | "future"

/** 상태는 오늘 날짜와 실제 출석 기록으로만 정한다. 순번·streak로 추정하지 않는다 */
export function dayStatus(key: DateKey, todayKey: DateKey, claimed: ReadonlySet<DateKey>): DayStatus {
  if (claimed.has(key)) return "claimed"
  if (key === todayKey) return "today"
  // YYYY-MM-DD는 사전순 비교 = 날짜순 비교다
  return key < todayKey ? "missed" : "future"
}

const STATUS_LABEL: Record<DayStatus, string> = {
  claimed: "출석 완료",
  today: "오늘, 출석 보상을 받을 수 있어요",
  missed: "미출석",
  future: "아직 오지 않은 날",
}

/** 스크린 리더용. "8월 23일, 출석 완료" */
export function dayAriaLabel(key: DateKey, status: DayStatus): string {
  const { month, day } = parseDateKey(key)
  return `${month}월 ${day}일, ${STATUS_LABEL[status]}`
}

// ─── KST 시각 ───────────────────────────────────────────────────────────────
// 아래 두 함수만 "지금"을 다룬다. 나머지는 전부 순수 계산이다.

/**
 * 그 시점의 Asia/Seoul 날짜 키.
 * toISOString().slice(0,10)은 UTC로 잘라 KST 자정~09시 사이에 하루가 어긋난다.
 * sv-SE 로케일이 YYYY-MM-DD 형식을 주므로 시간대만 지정해 쓴다.
 */
export function kstDateKey(at: Date): DateKey {
  return at.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).split(" ")[0]
}

/** 다음 KST 자정까지 남은 밀리초. 자정에 화면 날짜를 다시 계산하는 데 쓴다 */
export function msUntilNextKstMidnight(at: Date): number {
  const nextKey = addDays(kstDateKey(at), 1)
  return new Date(`${nextKey}T00:00:00.000${KST_OFFSET}`).getTime() - at.getTime()
}
