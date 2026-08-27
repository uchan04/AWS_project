"use client"

// 소유자: B. 출석 캘린더. 실제 날짜·요일을 보여주는 주간 7칸 + 월간 전환.
//
// 날짜 계산은 전부 lib/missions/calendar.ts의 순수 함수가 한다(npm run check:attendance).
// 이 파일은 그 결과를 그리고, 상태는 서버가 준 것만 쓴다:
//   - 오늘: dashboard.attendance.todayKey (KST). 브라우저 시간대로 정하지 않는다
//   - 완료 여부: dashboard.attendance.claimedDates / GET /api/missions/attendance?month=
// 보상 수령은 기존 POST /api/missions/attendance/claim 그대로다. 낙관적 갱신을 하지 않고
// 응답을 받은 뒤 대시보드를 다시 읽는다 — 실패한 수령이 완료로 보이면 안 된다.
//
// 출석은 오늘 날짜 칸을 눌러서 한다. 별도 출석 버튼·기간 이동 버튼은 두지 않는다.
// 연월 글자가 월간 보기 토글이다. streak는 상단 "연속 달성" 통계 카드와 중복이라 안 쓴다.
// 색은 미션 페이지가 이미 쓰는 값만 쓴다: 완료는 종족 파랑 + 흰 글자,
// 미완료·미래는 베이지 #F5F0E8 + 갈색 #9A8A76.

import { useCallback, useEffect, useState } from "react"
import {
  type AttendanceWindow,
  type DateKey,
  type DayStatus,
  dayAriaLabel,
  dayStatus,
  formatMonthTitle,
  kstDateKey,
  monthGrid,
  msUntilNextKstMidnight,
  parseDateKey,
  weekdayOf,
  windowFor,
  windowMonthKey,
} from "@/lib/missions/calendar"
import styles from "./mission-ui.module.css"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
const GRID_ID = "attendance-calendar-grid"

// 미션 페이지가 쓰는 베이지·갈색. 새로 만든 색이 아니다
const BEIGE = "#F5F0E8"
const BROWN = "#9A8A76"
const INK = "#2A1F14"

interface AttendanceCalendarProps {
  cycleDay: number
  claimedToday: boolean
  attendanceTotal: number
  /** 서버가 계산한 연속 달성 일수. 상단 통계 카드가 이미 보여주므로 캘린더에서는 쓰지 않는다 */
  streak: number
  /** KST 기준 오늘 */
  todayKey: DateKey
  /** claimedDates가 담고 있는 달(YYYY-MM) */
  month: string
  claimedDates: DateKey[]
  color: string
  bg: string
  /** 대시보드 재조회. 수령 성공·날짜 변경 시 호출한다 */
  onRefresh: () => void
}

export function AttendanceCalendar({
  claimedToday,
  todayKey,
  month,
  claimedDates,
  color,
  bg,
  onRefresh,
}: AttendanceCalendarProps) {
  const [win, setWin] = useState<AttendanceWindow>(() => windowFor(todayKey))
  const [monthly, setMonthly] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  // 이번 달 외의 달만 담는다. 이번 달은 props가 항상 최신이라 캐시하면 오히려 낡는다.
  // 자정에 달이 바뀌는 순간(win은 새 달, props.month는 아직 이전 달)에만 쓰인다
  const [otherMonths, setOtherMonths] = useState<Record<string, DateKey[]>>({})
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null)
  const [monthError, setMonthError] = useState<string | null>(null)
  // 조회 실패 후 재시도 버튼이 같은 달을 다시 읽게 하는 신호
  const [retryTick, setRetryTick] = useState(0)

  const shownMonth = windowMonthKey(win)
  const claimedList = shownMonth === month ? claimedDates : otherMonths[shownMonth]
  const claimedSet = new Set(claimedList ?? [])
  const monthReady = claimedList !== undefined

  // 보고 있는 달이 props의 달과 다르면 그 달 기록을 읽는다. 한 번 읽은 달은 다시 읽지 않는다
  useEffect(() => {
    if (shownMonth === month || otherMonths[shownMonth] !== undefined) return

    let alive = true
    void (async () => {
      setLoadingMonth(shownMonth)
      setMonthError(null)
      try {
        const res = await fetch(`/api/missions/attendance?month=${shownMonth}`)
        const json = await res.json()
        if (!alive) return
        if (!res.ok) {
          setMonthError(json.error?.message ?? "출석 기록을 불러오지 못했어요")
          return
        }
        setOtherMonths((prev) => ({ ...prev, [json.data.month]: json.data.claimedDates }))
      } catch {
        if (alive) setMonthError("출석 기록을 불러오지 못했어요")
      } finally {
        if (alive) setLoadingMonth(null)
      }
    })()

    return () => {
      alive = false
    }
  }, [shownMonth, month, otherMonths, retryTick])

  const jumpToToday = useCallback(() => {
    setWin(windowFor(kstDateKey(new Date())))
  }, [])

  // KST 자정을 넘기면 오늘이 바뀐다. 화면을 열어둔 채 날짜가 넘어가도 전날 구간에 남지 않는다
  useEffect(() => {
    const timer = setTimeout(() => {
      jumpToToday()
      onRefresh()
    }, msUntilNextKstMidnight(new Date()) + 1000)
    return () => clearTimeout(timer)
  }, [todayKey, jumpToToday, onRefresh])

  // 탭을 오래 두고 돌아온 경우. 짧은 주기 polling은 두지 않는다
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState !== "visible") return
      if (kstDateKey(new Date()) === todayKey) return
      jumpToToday()
      onRefresh()
    }
    document.addEventListener("visibilitychange", handleVisible)
    return () => document.removeEventListener("visibilitychange", handleVisible)
  }, [todayKey, jumpToToday, onRefresh])

  async function handleClaim() {
    if (claiming || claimedToday) return
    setClaiming(true)
    setClaimError(null)
    try {
      const res = await fetch("/api/missions/attendance/claim", { method: "POST" })
      const json = await res.json()

      if (!res.ok) {
        setClaimError(json.error?.message ?? "출석 수령에 실패했어요")
        return
      }
      // 성공·중복 모두 서버 상태를 다시 읽는다. 화면에서 먼저 완료로 바꾸지 않는다
      onRefresh()
      if (!json.data.alreadyClaimed) {
        window.dispatchEvent(new CustomEvent("user-stats-changed"))
      }
    } catch {
      setClaimError("네트워크 상태를 확인해 주세요")
    } finally {
      setClaiming(false)
    }
  }

  // 상태별 색. 파랑(완료)과 베이지(미완료)만 쓰고, 미래는 대비만 낮춘다
  function cellStyle(status: DayStatus, isToday: boolean): React.CSSProperties {
    switch (status) {
      case "claimed":
        return isToday
          ? { background: color, color: "#FFFFFF", borderColor: color }
          : { background: `${color}CC`, color: "#FFFFFF", borderColor: "transparent" }
      case "today":
        return { background: BEIGE, color: INK, borderColor: color }
      case "missed":
        return { background: BEIGE, color: BROWN, borderColor: "transparent" }
      case "future":
        return { background: BEIGE, color: BROWN, borderColor: "transparent", opacity: 0.55 }
    }
  }

  /** 주간 칸. 위에 요일, 아래에 날짜 */
  function renderCell(key: DateKey) {
    const { month: m, day } = parseDateKey(key)
    const isToday = key === todayKey

    // 달이 바뀌어 기록을 다시 읽는 중에는 상태를 단정하지 않는다 (미출석으로 잘못 보이면 안 된다)
    if (!monthReady) {
      return (
        <div
          key={key}
          className={styles.attCell}
          style={{ background: BEIGE, color: BROWN, opacity: 0.5 }}
          aria-label={`${m}월 ${day}일, 출석 기록을 불러오는 중`}
        >
          <span className={styles.attCellWeekday} aria-hidden="true">
            {WEEKDAYS[weekdayOf(key)]}
          </span>
          <span className={styles.attCellDay}>
            {day}
            <span className={styles.attCellSuffix}>일</span>
          </span>
        </div>
      )
    }

    const status = dayStatus(key, todayKey, claimedSet)
    // 오늘이고 아직 안 받은 칸만 누를 수 있다. 과거 소급·미래 선수령은 없다
    const claimable = status === "today" && !claimedToday

    return (
      <button
        key={key}
        type="button"
        className={styles.attCell}
        style={cellStyle(status, isToday)}
        disabled={!claimable || claiming}
        aria-current={isToday ? "date" : undefined}
        aria-label={dayAriaLabel(key, status)}
        onClick={claimable ? handleClaim : undefined}
      >
        <span className={styles.attCellWeekday} aria-hidden="true">
          {WEEKDAYS[weekdayOf(key)]}
        </span>
        <span className={styles.attCellDay}>
          {day}
          <span className={styles.attCellSuffix}>일</span>
          {status === "claimed" && (
            <span className={styles.attCellCheck} aria-hidden="true">
              ✓
            </span>
          )}
        </span>
      </button>
    )
  }

  /** 월간 칸. 같은 색·같은 둥근 사각형을 작게 쓴다 */
  function renderMonthCell(key: DateKey) {
    const status = dayStatus(key, todayKey, claimedSet)
    const { day } = parseDateKey(key)
    const isToday = key === todayKey
    const claimable = status === "today" && !claimedToday

    return (
      <button
        key={key}
        type="button"
        className={styles.attMonthCell}
        style={cellStyle(status, isToday)}
        disabled={!claimable || claiming}
        aria-current={isToday ? "date" : undefined}
        aria-label={dayAriaLabel(key, status)}
        onClick={claimable ? handleClaim : undefined}
      >
        {day}
        {status === "claimed" && (
          <span className={styles.attCellCheck} aria-hidden="true">
            ✓
          </span>
        )}
      </button>
    )
  }

  return (
    <>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 19,
          color: "#2A1F14",
          margin: "0 0 14px",
        }}
      >
        출석 캘린더
      </h2>
      <section className={styles.attCard} style={{ background: bg, border: `1.5px solid ${color}33` }}>
        <div className={styles.attHead}>
          {/* 연월 글자를 누르면 월간 기록으로 바뀐다 */}
          <button
            type="button"
            className={styles.attMonthLabel}
            aria-expanded={monthly}
            aria-controls={GRID_ID}
            aria-label={monthly ? `${formatMonthTitle(shownMonth)}, 주간 보기로 돌아가기` : `${formatMonthTitle(shownMonth)}, 이번 달 기록 보기`}
            onClick={() => setMonthly((v) => !v)}
          >
            {formatMonthTitle(shownMonth)}
            <span className={styles.attMonthCaret} aria-hidden="true">
              {monthly ? "⌃" : "⌄"}
            </span>
          </button>
        </div>

        {/* 주간과 월간은 같은 자리에서 교체된다. 동시에 보여주지 않는다 */}
        <div id={GRID_ID}>
          {monthly ? (
            loadingMonth || !monthReady ? (
              <div className={styles.attSkeleton} aria-hidden="true" />
            ) : (
              <>
                <div className={styles.attWeekdays}>
                  {WEEKDAYS.map((label) => (
                    <span key={label} className={styles.attWeekday} aria-hidden="true">
                      {label}
                    </span>
                  ))}
                </div>
                {monthGrid(shownMonth).map((week, wi) => (
                  <div key={wi} className={styles.attMonthWeek}>
                    {week.map((key, di) =>
                      key ? (
                        renderMonthCell(key)
                      ) : (
                        <div key={`pad-${wi}-${di}`} className={styles.attPad} aria-hidden="true" />
                      )
                    )}
                  </div>
                ))}
              </>
            )
          ) : (
            <div className={styles.attDays}>
              {win.dateKeys.map((key) => renderCell(key))}
              {/* 말일 구간은 7칸을 못 채운다. 다음 달 날짜를 섞지 않고 열만 비워 둔다 */}
              {Array.from({ length: 7 - win.dateKeys.length }, (_, i) => (
                <div key={`empty-${i}`} className={styles.attPad} aria-hidden="true" />
              ))}
            </div>
          )}
        </div>

        {monthError && (
          <div className={styles.attErrorRow}>
            <span className={styles.attError}>{monthError}</span>
            <button type="button" className={styles.attRetry} onClick={() => setRetryTick((t) => t + 1)}>
              다시 시도
            </button>
          </div>
        )}

        <div className={styles.attStatus}>
          {claimedToday ? (
            <p className={styles.attStatusDone} style={{ color }}>
              ✓ 오늘 출석은 이미 받았어요
            </p>
          ) : (
            <p className={styles.attStatusPrompt}>{claiming ? "출석 중..." : "오늘 날짜를 눌러 출석해요"}</p>
          )}
          {claimError && <p className={styles.attError}>{claimError}</p>}
        </div>
      </section>
    </>
  )
}
