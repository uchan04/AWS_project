import assert from "node:assert/strict"
import {
  addDays,
  dateKey,
  dayStatus,
  formatMonthTitle,
  formatWindowRange,
  isValidMonthKey,
  kstDateKey,
  lastDayOfMonth,
  monthGrid,
  msUntilNextKstMidnight,
  nextWindow,
  prevWindow,
  sameWindow,
  windowFor,
  windowMonthKey,
  windowStartDay,
} from "../lib/missions/calendar"

// npm run check:attendance
// 출석 캘린더의 날짜 구간 계산. 테스트 프레임워크는 쓰지 않는다 (CLAUDE.md 8절,
// check-pet.ts·check-diagnosis.ts와 같은 방식). DB에 붙지 않는 순수 계산만 본다.
//
// 구간 규칙: 1~7 / 8~14 / 15~21 / 22~28 / 29~말일. 다음 달 날짜를 섞지 않는다.

// ─── 구간 시작일 ────────────────────────────────────────────────────────────

assert.equal(windowStartDay(1), 1)
assert.equal(windowStartDay(7), 1)
assert.equal(windowStartDay(8), 8)
assert.equal(windowStartDay(14), 8)
assert.equal(windowStartDay(15), 15)
assert.equal(windowStartDay(21), 15)
assert.equal(windowStartDay(22), 22)
assert.equal(windowStartDay(28), 22)
assert.equal(windowStartDay(29), 29)
assert.equal(windowStartDay(30), 29)
assert.equal(windowStartDay(31), 29)

// ─── 명세에 적힌 기대값 ─────────────────────────────────────────────────────

function span(key: string): string {
  const w = windowFor(key)
  return `${w.year}-${w.month}: ${w.startDay}~${w.endDay}`
}

assert.equal(span("2026-08-01"), "2026-8: 1~7")
assert.equal(span("2026-08-07"), "2026-8: 1~7")
assert.equal(span("2026-08-08"), "2026-8: 8~14")
assert.equal(span("2026-08-14"), "2026-8: 8~14")
assert.equal(span("2026-08-23"), "2026-8: 22~28")
assert.equal(span("2026-08-31"), "2026-8: 29~31")

// 구간 길이. 말일 구간만 7보다 짧을 수 있다
assert.equal(windowFor("2026-08-01").dateKeys.length, 7)
assert.deepEqual(windowFor("2026-08-08").dateKeys, [
  "2026-08-08",
  "2026-08-09",
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
])
assert.deepEqual(windowFor("2026-08-31").dateKeys, ["2026-08-29", "2026-08-30", "2026-08-31"])

// ─── 월 경계 이동 ───────────────────────────────────────────────────────────

assert.equal(span("2026-08-31"), "2026-8: 29~31")
assert.equal(
  (() => {
    const w = nextWindow(windowFor("2026-08-31"))
    return `${w.year}-${w.month}: ${w.startDay}~${w.endDay}`
  })(),
  "2026-9: 1~7"
)
assert.equal(
  (() => {
    const w = prevWindow(windowFor("2026-09-01"))
    return `${w.year}-${w.month}: ${w.startDay}~${w.endDay}`
  })(),
  "2026-8: 29~31"
)

// 12월 31일 → 다음 해 1월 1~7일
{
  const w = nextWindow(windowFor("2026-12-31"))
  assert.equal(w.year, 2027)
  assert.equal(w.month, 1)
  assert.equal(w.startDay, 1)
  // 되돌아오면 12월 29~31
  const back = prevWindow(w)
  assert.equal(back.year, 2026)
  assert.equal(back.month, 12)
  assert.deepEqual(back.dateKeys, ["2026-12-29", "2026-12-30", "2026-12-31"])
}

// 2월. 평년 28일이면 마지막 구간이 22~28이고 29일 구간이 없다
assert.equal(lastDayOfMonth(2026, 2), 28)
assert.equal(span("2026-02-28"), "2026-2: 22~28")
assert.equal(windowFor("2026-02-28").dateKeys.length, 7)
{
  const w = prevWindow(windowFor("2026-03-01"))
  assert.equal(`${w.month}: ${w.startDay}~${w.endDay}`, "2: 22~28")
}

// 윤년 2월 29일은 29~29 한 칸 구간이다
assert.equal(lastDayOfMonth(2028, 2), 29)
assert.equal(span("2028-02-29"), "2028-2: 29~29")
assert.deepEqual(windowFor("2028-02-29").dateKeys, ["2028-02-29"])
{
  const w = prevWindow(windowFor("2028-03-01"))
  assert.equal(`${w.month}: ${w.startDay}~${w.endDay}`, "2: 29~29")
}

// 30일 달의 말일 구간은 29~30
assert.equal(lastDayOfMonth(2026, 9), 30)
assert.equal(span("2026-09-30"), "2026-9: 29~30")

// ─── 이전·다음 왕복과 현재 구간 복귀 ────────────────────────────────────────

{
  const today = windowFor("2026-08-23")
  assert.ok(sameWindow(today, windowFor("2026-08-22")))
  assert.ok(!sameWindow(today, windowFor("2026-08-21")))

  // 앞으로 3번 갔다가 뒤로 3번 오면 제자리
  let w = today
  for (let i = 0; i < 3; i++) w = nextWindow(w)
  for (let i = 0; i < 3; i++) w = prevWindow(w)
  assert.ok(sameWindow(w, today))

  // 뒤로 5번 갔다가 앞으로 5번 와도 제자리 (월을 두 번 넘는다)
  for (let i = 0; i < 5; i++) w = prevWindow(w)
  for (let i = 0; i < 5; i++) w = nextWindow(w)
  assert.ok(sameWindow(w, today))

  // "오늘" 버튼 = 오늘 키로 구간을 다시 만든다
  assert.ok(sameWindow(windowFor("2026-08-23"), today))
}

assert.equal(windowMonthKey(windowFor("2026-08-23")), "2026-08")
assert.equal(formatMonthTitle("2026-08"), "2026년 8월")

// 기간 라벨. 올해면 연도를 붙이지 않고, 한 칸 구간은 하루만 적는다
assert.equal(formatWindowRange(windowFor("2026-08-23"), "2026-08-23"), "8월 22일–28일")
assert.equal(formatWindowRange(windowFor("2026-08-31"), "2026-08-23"), "8월 29일–31일")
assert.equal(formatWindowRange(windowFor("2025-12-31"), "2026-08-23"), "2025년 12월 29일–31일")
assert.equal(formatWindowRange(windowFor("2028-02-29"), "2028-02-29"), "2월 29일")
assert.equal(isValidMonthKey("2026-08"), true)
assert.equal(isValidMonthKey("2026-13"), false)
assert.equal(isValidMonthKey("2026-8"), false)
assert.equal(isValidMonthKey("' OR 1=1"), false)

// ─── 날짜 키 산술 ───────────────────────────────────────────────────────────

assert.equal(addDays("2026-08-31", 1), "2026-09-01")
assert.equal(addDays("2026-01-01", -1), "2025-12-31")
assert.equal(addDays("2028-02-28", 1), "2028-02-29")
assert.equal(addDays("2026-02-28", 1), "2026-03-01")
assert.equal(dateKey(2026, 8, 3), "2026-08-03")

// ─── 월간 격자 ──────────────────────────────────────────────────────────────

{
  const weeks = monthGrid("2026-08")
  // 2026-08-01은 토요일이라 앞에 빈 칸 6개
  assert.equal(weeks[0].slice(0, 6).every((c) => c === null), true)
  assert.equal(weeks[0][6], "2026-08-01")
  // 실제 날짜 칸 수 = 그 달 일수
  const filled = weeks.flat().filter((c) => c !== null)
  assert.equal(filled.length, 31)
  assert.equal(filled[30], "2026-08-31")
  // 모든 줄은 7칸
  assert.equal(weeks.every((w) => w.length === 7), true)
}

// ─── 상태 판정. 순번이 아니라 실제 기록으로만 정한다 ────────────────────────

{
  const today = "2026-08-23"
  const claimed = new Set(["2026-08-21", "2026-08-23"])
  assert.equal(dayStatus("2026-08-21", today, claimed), "claimed")
  assert.equal(dayStatus("2026-08-22", today, claimed), "missed") // 과거인데 기록 없음
  assert.equal(dayStatus("2026-08-23", today, claimed), "claimed") // 오늘이고 이미 받음
  assert.equal(dayStatus("2026-08-24", today, claimed), "future")
  assert.equal(dayStatus("2026-08-23", today, new Set()), "today") // 오늘이고 아직 안 받음
  // 달이 넘어가도 사전순 비교가 날짜순과 같다
  assert.equal(dayStatus("2026-07-31", today, new Set()), "missed")
  assert.equal(dayStatus("2026-09-01", today, new Set()), "future")
}

// ─── KST 경계 ───────────────────────────────────────────────────────────────

// UTC 15:00 = KST 자정. toISOString().slice(0,10)로 자르면 하루 어긋나는 구간이다
assert.equal(kstDateKey(new Date("2026-08-22T14:59:59Z")), "2026-08-22")
assert.equal(kstDateKey(new Date("2026-08-22T15:00:00Z")), "2026-08-23")
assert.equal(kstDateKey(new Date("2026-08-23T00:00:00Z")), "2026-08-23") // UTC 자정은 KST 오전 9시
assert.equal(kstDateKey(new Date("2026-08-23T14:59:59Z")), "2026-08-23")

// KST 자정을 넘기면 구간도 넘어간다 (7일 23:59 → 8일 00:00)
assert.equal(span(kstDateKey(new Date("2026-08-07T14:59:00Z"))), "2026-8: 1~7")
assert.equal(span(kstDateKey(new Date("2026-08-07T15:00:00Z"))), "2026-8: 8~14")

// 다음 KST 자정까지 남은 시간
assert.equal(msUntilNextKstMidnight(new Date("2026-08-22T15:00:00Z")), 24 * 3600 * 1000)
assert.equal(msUntilNextKstMidnight(new Date("2026-08-23T14:59:59Z")), 1000)
assert.equal(msUntilNextKstMidnight(new Date("2026-12-31T15:00:00Z")), 24 * 3600 * 1000)
assert.ok(msUntilNextKstMidnight(new Date()) > 0)

console.log("✓ check-attendance 통과")
