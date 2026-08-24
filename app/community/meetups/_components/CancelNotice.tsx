"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { meetupDateTime } from "../../_lib/format"
import type { CancelNoticeItem } from "../_lib/notice"
import { FadeIn, Spinner } from "./transitions"

/**
 * 무산된 모임 알림 배너. 껍데기 어휘는 HopeBanner의 중립 배너와 같다
 * (rounded-2xl border border-neutral-200 bg-neutral-50 p-5 + 좌측 아이콘).
 *
 * 문구는 사실만 전한다. "아쉽게도"·"죄송합니다" 같은 말을 붙이지 않는다 —
 * 무산은 유저가 잘못한 일이 아니고, 사과를 얹으면 실망만 커진다.
 * 대신 하단에 다음 모임으로 가는 링크를 둔다.
 */
export function CancelNotice({ notices }: { notices: CancelNoticeItem[] }) {
  const [dismissed, setDismissed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entered, setEntered] = useState(false)

  // 마운트된 프레임에 최종 상태를 칠하면 전환이 생기지 않는다. 한 프레임 뒤에 올린다.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  if (notices.length === 0 || dismissed) return null

  async function handleConfirm() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/community/meetups/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetupIds: notices.map((notice) => notice.meetupId) }),
      })
      const json = await res.json()
      if (json.error) {
        // 실패하면 배너를 그대로 둔다. 닫아버리면 읽음 처리가 안 된 채 알림만 사라진다.
        setError(json.error.message)
        return
      }
      setDismissed(true)
    } finally {
      setPending(false)
    }
  }

  const isSingle = notices.length === 1

  return (
    <div
      className={
        "flex items-start gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 motion-safe:transition motion-safe:duration-300 motion-safe:ease-out " +
        (entered ? "" : "motion-safe:-translate-y-2 motion-safe:opacity-0")
      }
    >
      <span aria-hidden="true" className="text-4xl">
        🗓️
      </span>

      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-base leading-relaxed text-neutral-900">
          {isSingle
            ? `신청하신 '${notices[0].title}' 모임이 무산되었어요.`
            : `무산된 모임이 ${notices.length}건 있어요.`}
        </p>

        {!isSingle && (
          <ul className="flex flex-col gap-1">
            {notices.map((notice) => (
              <li key={notice.meetupId} className="text-sm text-neutral-600">
                {notice.title}
                <span className="text-xs text-neutral-400">
                  {" · "}
                  {meetupDateTime(notice.startsAt)}
                  {" · "}
                  {notice.place}
                </span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <FadeIn key={error} className="block text-xs text-red-500">
            {error}
          </FadeIn>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex items-center rounded-xl border border-neutral-900 bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition duration-150 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending && <Spinner />}
            확인
          </button>

          <Link
            href="/community/meetups"
            className="text-sm font-semibold text-neutral-500 underline underline-offset-4 transition duration-150 hover:text-neutral-700"
          >
            다른 모임 둘러보기
          </Link>
        </div>
      </div>
    </div>
  )
}
