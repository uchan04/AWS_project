"use client"

import { useEffect, useRef, useState } from "react"
import { GalleryType } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { FadeIn, Spinner } from "./transitions"

// 열림·닫힘 전환 길이. WriteModal.tsx에는 모달 전환이 없어 여기서 정한 값이며,
// 닫힐 때 이 시간만큼 언마운트를 미뤄야 사라지는 전환이 보인다.
const MODAL_MS = 150

// 갤러리 선택지는 스키마 enum이 유일한 출처다. 로컬 상수로 4종을 다시 적으면
// enum이 늘었을 때 화면만 조용히 낡는다.
const GALLERY_OPTIONS = Object.values(GalleryType)

function galleryLabel(gallery: GalleryType): string {
  return gallery === GalleryType.ALL ? "전체" : `${TRIBE[gallery].animal} 갤러리`
}

/** 관리자 전용. MeetupList가 isAdmin일 때만 이 컴포넌트를 렌더 트리에 넣는다. */
export function MeetupCreateModal({ onCreated }: { onCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [galleryType, setGalleryType] = useState<GalleryType>(GalleryType.ALL)
  const [title, setTitle] = useState("")
  const [place, setPlace] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [minCount, setMinCount] = useState("1")
  const [capacity, setCapacity] = useState("")
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entered, setEntered] = useState(false)
  const closeTimer = useRef<number | null>(null)

  // 마운트된 프레임에 최종 상태를 칠하면 전환이 생기지 않는다. 한 프레임 뒤에 올린다.
  useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

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

  function close() {
    if (closeTimer.current !== null) return
    setEntered(false)
    // 전환이 끝난 뒤에 언마운트한다. 바로 지우면 opacity·scale이 보이지 않고 툭 사라진다.
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      setIsOpen(false)
      setGalleryType(GalleryType.ALL)
      setTitle("")
      setPlace("")
      setStartsAt("")
      setMinCount("1")
      setCapacity("")
      setBody("")
      setError(null)
    }, MODAL_MS)
  }

  const canSubmit = Boolean(title.trim() && place.trim() && body.trim() && startsAt && capacity)

  async function handleSubmit() {
    if (!canSubmit || pending) return

    setPending(true)
    setError(null)
    try {
      // datetime-local은 시간대가 없는 "2026-08-30T19:00" 형태다. 그대로 보내면 서버(UTC)가
      // 자기 시간대로 해석해 9시간 밀린다. 브라우저 시간대로 해석한 뒤 ISO로 바꿔 보낸다.
      const res = await fetch("/api/community/meetups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galleryType,
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

  const FIELD =
    "w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-500"

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-xl border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-150 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:hover:-translate-y-0.5"
      >
        모임 개설
      </button>

      {isOpen && (
        <div
          className={
            "fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out " +
            (entered ? "" : "motion-safe:opacity-0")
          }
          onClick={close}
        >
          <div
            className={
              "max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl motion-safe:transition motion-safe:duration-150 motion-safe:ease-out " +
              (entered ? "" : "motion-safe:scale-95 motion-safe:opacity-0")
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">오프라인 모임 개설</h2>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {GALLERY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGalleryType(option)}
                  className={
                    "rounded-xl border px-4 py-2 text-sm font-semibold transition duration-150 " +
                    (option === galleryType
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50")
                  }
                >
                  {galleryLabel(option)}
                </button>
              ))}
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="모임 제목을 입력해주세요"
              className={"mb-3 " + FIELD}
            />

            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="장소를 입력해주세요"
              className={"mb-3 " + FIELD}
            />

            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={"mb-3 " + FIELD}
            />

            <div className="mb-3 flex gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-xs text-neutral-400">최소 인원</span>
                <input
                  type="number"
                  min={1}
                  value={minCount}
                  onChange={(e) => setMinCount(e.target.value)}
                  className={FIELD}
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs text-neutral-400">정원</span>
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className={FIELD}
                />
              </label>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"어떤 모임인지 알려주세요\n무엇을 하고, 무엇을 준비하면 되는지요."}
              rows={5}
              className={"mb-4 resize-none leading-relaxed " + FIELD}
            />

            {error && (
              <FadeIn key={error} className="mb-3 block text-xs text-red-500">
                {error}
              </FadeIn>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !canSubmit}
                className="inline-flex items-center rounded-xl border border-neutral-900 bg-neutral-900 px-6 py-2.5 text-sm font-bold text-white transition duration-150 disabled:cursor-not-allowed disabled:opacity-40"
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
