"use client"

import { useEffect, useRef, useState } from "react"
import { GalleryType } from "@prisma/client"
import { meetupDateTime } from "../../_lib/format"
import { FadeIn, Spinner } from "./transitions"

/*
 * 갤러리 선택 UI는 뺐고, 개설은 항상 galleryType: ALL로 보낸다.
 *
 * 스키마의 Meetup.galleryType 컬럼과 API(POST /api/community/meetups)의 galleryType 검증은
 * 그대로 살려 둔다. 종족 모임을 열기로 하면 여기 선택지만 되살리면 되고,
 * 컬럼을 지웠다면 마이그레이션과 라우트·화면을 전부 되돌려야 한다.
 * 지금 화면에서만 ALL로 고정하는 이유다.
 */
const FIXED_GALLERY = GalleryType.ALL

// 열림·닫힘 전환 길이. WriteModal.tsx에는 모달 전환이 없어 여기서 정한 값이며,
// 닫힐 때 이 시간만큼 언마운트를 미뤄야 사라지는 전환이 보인다.
const MODAL_MS = 150

// 검증에 걸린 칸의 링을 걷어내기까지의 시간. 한 번만 강조하고 멈춘다 —
// 계속 깜빡이면 시선이 붙잡혀 정작 그 칸에 뭘 적어야 하는지 읽기 어렵다.
const EMPHASIS_MS = 450

// POST /api/community/meetups의 상한과 같은 값.
const TITLE_MAX = 80
const PLACE_MAX = 120
const BODY_MAX = 2000

type FieldName = "title" | "place" | "startsAt" | "minCount" | "capacity" | "body"

/** 관리자 전용. MeetupList가 isAdmin일 때만 이 컴포넌트를 렌더 트리에 넣는다. */
export function MeetupCreateModal({ onCreated }: { onCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [place, setPlace] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [minCount, setMinCount] = useState("1")
  const [capacity, setCapacity] = useState("")
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<FieldName[]>([])
  // 검증을 돌린 시각. "모임 일시는 현재보다 뒤" 판정의 기준이며, 렌더 중에 Date.now()를 부르지 않으려고
  // 개설하기를 누른 순간의 값을 붙들어 둔다(렌더마다 값이 달라지면 순수하지 않은 컴포넌트가 된다).
  const [checkedAt, setCheckedAt] = useState(0)
  const [emphasized, setEmphasized] = useState(false)
  const [entered, setEntered] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const emphasisTimer = useRef<number | null>(null)
  const startsAtRef = useRef<HTMLInputElement | null>(null)

  // 마운트된 프레임에 최종 상태를 칠하면 전환이 생기지 않는다. 한 프레임 뒤에 올린다.
  useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
      if (emphasisTimer.current !== null) window.clearTimeout(emphasisTimer.current)
    }
  }, [])

  /**
   * 서버 POST 검증(app/api/community/meetups/route.ts)과 같은 조건으로,
   * 통과하지 못한 칸의 이름을 모은다. 조건이 갈리면 화면은 멀쩡한데 서버가 400을 주는
   * 상황이 생기므로 여기에 새 조건을 더하지 않는다.
   */
  function collectInvalid(now: number): FieldName[] {
    const next: FieldName[] = []

    const trimmedTitle = title.trim()
    if (!trimmedTitle || trimmedTitle.length > TITLE_MAX) next.push("title")

    const trimmedPlace = place.trim()
    if (!trimmedPlace || trimmedPlace.length > PLACE_MAX) next.push("place")

    // new Date("")는 throw하지 않고 Invalid Date를 준다. 서버와 같이 getTime()이 NaN인지로 본다.
    const startsAtDate = new Date(startsAt)
    if (!startsAt || Number.isNaN(startsAtDate.getTime()) || startsAtDate.getTime() <= now) {
      next.push("startsAt")
    }

    // 서버는 Number.isInteger로 받는다. 빈 칸은 Number("")가 0이라 여기서 함께 걸린다.
    const capacityNumber = Number(capacity)
    const capacityOk = capacity.trim() !== "" && Number.isInteger(capacityNumber) && capacityNumber >= 1
    if (!capacityOk) next.push("capacity")

    const minCountNumber = Number(minCount)
    const minCountOk = minCount.trim() !== "" && Number.isInteger(minCountNumber) && minCountNumber >= 1
    // "최소 인원은 정원보다 많을 수 없어요"도 최소 인원 칸에 표시한다 — 고칠 곳이 그쪽이다.
    if (!minCountOk || (capacityOk && minCountNumber > capacityNumber)) next.push("minCount")

    const trimmedBody = body.trim()
    if (!trimmedBody || trimmedBody.length > BODY_MAX) next.push("body")

    return next
  }

  /*
   * 고친 칸의 붉은 테두리는 다음 렌더에서 바로 풀린다. 상태를 되쓰지 않고 렌더 중에 걸러내는 이유는
   * 입력할 때마다 effect로 setState를 돌리면 타이핑 한 글자마다 렌더가 두 번씩 나기 때문이다.
   * 걷어내기만 하고 더하지는 않는다 — 아직 개설하기를 누르지도 않은 칸을 입력 도중에 붉게 칠하면
   * 재촉하는 화면이 된다.
   */
  const stillInvalid = invalid.length > 0 ? collectInvalid(checkedAt) : null
  const shownInvalid = stillInvalid ? invalid.filter((field) => stillInvalid.includes(field)) : invalid

  function open() {
    // 닫힘 전환이 도는 중에 다시 열면 예약된 언마운트를 취소한다.
    // 그냥 두면 방금 연 모달을 그 타이머가 닫아버린다.
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
      setEntered(true)
    }
    setIsOpen(true)
  }

  /**
   * 닫는 길은 X 버튼과 취소 버튼뿐이다. 오버레이 클릭·Esc로는 닫지 않는다 —
   * 작성 도중 한 번 잘못 누르면 적어 둔 내용이 통째로 날아간다.
   */
  function close() {
    if (closeTimer.current !== null) return
    setEntered(false)
    // 전환이 끝난 뒤에 언마운트한다. 바로 지우면 opacity·scale이 보이지 않고 툭 사라진다.
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      setIsOpen(false)
      setTitle("")
      setPlace("")
      setStartsAt("")
      setMinCount("1")
      setCapacity("")
      setBody("")
      setError(null)
      setInvalid([])
      setEmphasized(false)
    }, MODAL_MS)
  }

  async function handleSubmit() {
    if (pending) return

    // 버튼은 항상 눌린다. 막는 대신 누른 시점에 검증해서 어느 칸이 문제인지 보여준다.
    const now = Date.now()
    const failed = collectInvalid(now)
    if (failed.length > 0) {
      setCheckedAt(now)
      setInvalid(failed)
      setError(null)
      setEmphasized(true)
      if (emphasisTimer.current !== null) window.clearTimeout(emphasisTimer.current)
      emphasisTimer.current = window.setTimeout(() => {
        emphasisTimer.current = null
        setEmphasized(false)
      }, EMPHASIS_MS)
      return
    }

    setPending(true)
    setError(null)
    try {
      // datetime-local은 시간대가 없는 "2026-08-30T19:00" 형태다. 그대로 보내면 서버(UTC)가
      // 자기 시간대로 해석해 9시간 밀린다. 브라우저 시간대로 해석한 뒤 ISO로 바꿔 보낸다.
      const res = await fetch("/api/community/meetups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galleryType: FIXED_GALLERY,
          title: title.trim(),
          place: place.trim(),
          body: body.trim(),
          startsAt: new Date(startsAt).toISOString(),
          minCount: Number(minCount),
          capacity: Number(capacity),
        }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
        return
      }
      close()
      onCreated()
    } finally {
      setPending(false)
    }
  }

  const FIELD_BASE =
    "w-full rounded-xl border bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-muted outline-none motion-safe:transition motion-safe:duration-300 motion-safe:ease-out"

  // 강조는 링을 한 번 켰다 끄는 것으로 끝내고, 그 뒤에는 붉은 테두리만 남긴다.
  function fieldClass(field: FieldName) {
    if (!shownInvalid.includes(field)) return FIELD_BASE + " border-rule focus:border-rule-2"
    return (
      FIELD_BASE +
      " border-red-400 focus:border-red-500 " +
      (emphasized ? "motion-safe:ring-4 motion-safe:ring-red-100" : "ring-0")
    )
  }

  const startsAtDate = startsAt ? new Date(startsAt) : null
  const startsAtLabel =
    startsAtDate && !Number.isNaN(startsAtDate.getTime()) ? meetupDateTime(startsAtDate) : null

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-xl border border-accent bg-accent px-5 py-2.5 text-base font-display text-accent-ink shadow-sm transition duration-150 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:hover:-translate-y-0.5"
      >
        모임 개설
      </button>

      {isOpen && (
        <div
          className={
            "fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out " +
            (entered ? "" : "motion-safe:opacity-0")
          }
        >
          <div
            className={
              "max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-8 shadow-2xl motion-safe:transition motion-safe:duration-150 motion-safe:ease-out " +
              (entered ? "" : "motion-safe:scale-95 motion-safe:opacity-0")
            }
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">오프라인 모임 개설</h2>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-2 text-muted hover:bg-rule"
              >
                ✕
              </button>
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="모임 제목을 입력해주세요"
              className={"mb-3 " + fieldClass("title")}
            />

            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="장소를 입력해주세요"
              className={"mb-3 " + fieldClass("place")}
            />

            {/*
              브라우저 기본 달력은 밖에서 열고 닫을 방법이 없다. "완료"는 입력의 포커스를 빼서
              달력이 스스로 닫히게 하는 것뿐이다 — showPicker()로 닫히지는 않는다.
            */}
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  ref={startsAtRef}
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className={fieldClass("startsAt")}
                />
                <button
                  type="button"
                  onClick={() => startsAtRef.current?.blur()}
                  className="shrink-0 rounded-xl border border-rule bg-card px-4 py-2.5 text-base font-display text-ink-2 transition duration-150 hover:bg-paper-2"
                >
                  완료
                </button>
              </div>
              {startsAtLabel && <p className="mt-1.5 text-xs text-muted">{startsAtLabel} 시작</p>}
            </div>

            <div className="mb-3 flex gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-xs text-muted">최소 인원</span>
                <input
                  type="number"
                  min={1}
                  value={minCount}
                  onChange={(e) => setMinCount(e.target.value)}
                  className={fieldClass("minCount")}
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs text-muted">정원</span>
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className={fieldClass("capacity")}
                />
              </label>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"어떤 모임인지 알려주세요\n무엇을 하고, 무엇을 준비하면 되는지요."}
              rows={5}
              className={"mb-4 resize-none leading-relaxed " + fieldClass("body")}
            />

            {error && (
              <FadeIn key={error} className="mb-3 block text-xs text-error">
                {error}
              </FadeIn>
            )}

            <div className="flex items-center justify-end gap-3">
              {shownInvalid.length > 0 && (
                <FadeIn className="text-xs text-error">표시된 칸을 모두 채워주세요.</FadeIn>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-rule bg-card px-5 py-2.5 text-base font-display text-ink-2 transition duration-150 hover:bg-paper-2"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                aria-busy={pending}
                className="inline-flex items-center rounded-xl border border-accent bg-accent px-6 py-2.5 text-base font-display text-accent-ink transition duration-150"
              >
                {pending && <Spinner />}
                개설하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
