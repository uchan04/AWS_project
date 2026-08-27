"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { meetupDateTime } from "../../_lib/format"
import type { MeetupNoticeItem } from "../_lib/notice"
import { FadeIn, Spinner } from "./transitions"

/**
 * 모임 상태 변경 알림 배너. 결성(CONFIRMED)과 무산(CANCELED)을 함께 다룬다.
 * 껍데기 어휘는 HopeBanner의 중립 배너와 같다
 * (rounded-card border border-rule bg-paper p-5 + 좌측 아이콘).
 *
 * 문구는 양쪽 모두 사실만 전한다. 무산에 "아쉽게도"·"죄송합니다"를 붙이지 않는 것과 같은 이유로
 * 결성에도 "축하합니다"·"드디어"를 붙이지 않는다 — 과장은 다음 약속을 부담으로 만든다.
 */
export function MeetupNotice({ notices }: { notices: MeetupNoticeItem[] }) {
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
      // 종류를 구분하지 않고 한 번에 보낸다 — 라우트의 updateMany가 meetupIds로만 동작한다.
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

  const confirmed = notices.filter((notice) => notice.kind === "CONFIRMED")
  const canceled = notices.filter((notice) => notice.kind === "CANCELED")

  return (
    <div
      className={
        "flex flex-col gap-4 rounded-card border border-rule bg-paper p-5 motion-safe:transition motion-safe:duration-300 motion-safe:ease-out " +
        (entered ? "" : "motion-safe:-translate-y-2 motion-safe:opacity-0")
      }
    >
      {/* 결성이 위, 무산이 아래다. 갈 곳이 생긴 소식을 먼저 본다. */}
      {confirmed.length > 0 && (
        <NoticeGroup
          emoji="🤝"
          headline={
            confirmed.length === 1
              ? `신청하신 '${confirmed[0].title}' 모임이 결성되었어요.`
              : `결성된 모임이 ${confirmed.length}건 있어요.`
          }
          notices={confirmed}
          // 1건일 때는 목록을 띄우지 않지만 일시·장소는 다시 확인할 수 있어야 한다.
          showDetailWhenSingle
          linkLabel="내가 신청한 모임 보기"
        />
      )}

      {canceled.length > 0 && (
        <NoticeGroup
          emoji="🗓️"
          headline={
            canceled.length === 1
              ? `신청하신 '${canceled[0].title}' 모임이 무산되었어요.`
              : `무산된 모임이 ${canceled.length}건 있어요.`
          }
          notices={canceled}
          linkLabel="다른 모임 둘러보기"
        />
      )}

      {error && (
        <FadeIn key={error} className="block text-xs text-error">
          {error}
        </FadeIn>
      )}

      {/* 확인 버튼은 하나뿐이다. 결성·무산 meetupIds를 함께 읽음 처리한다. */}
      <div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="inline-flex items-center rounded-xl border border-accent bg-accent px-5 py-2 text-sm font-semibold text-accent-ink transition duration-150 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending && <Spinner />}
          확인
        </button>
      </div>
    </div>
  )
}

function NoticeGroup({
  emoji,
  headline,
  notices,
  showDetailWhenSingle = false,
  linkLabel,
}: {
  emoji: string
  headline: string
  notices: MeetupNoticeItem[]
  showDetailWhenSingle?: boolean
  linkLabel: string
}) {
  const isSingle = notices.length === 1

  return (
    <div className="flex items-start gap-4">
      <span aria-hidden="true" className="text-4xl">
        {emoji}
      </span>

      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-base leading-relaxed text-ink">{headline}</p>

        {isSingle && showDetailWhenSingle && (
          <p className="text-xs text-muted">
            {meetupDateTime(notices[0].startsAt)}
            {" · "}
            {notices[0].place}
          </p>
        )}

        {!isSingle && (
          <ul className="flex flex-col gap-1">
            {notices.map((notice) => (
              <li key={notice.meetupId} className="text-sm text-ink-2">
                {notice.title}
                <span className="text-xs text-muted">
                  {" · "}
                  {meetupDateTime(notice.startsAt)}
                  {" · "}
                  {notice.place}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/community/meetups"
          className="w-fit text-sm font-semibold text-muted underline underline-offset-4 transition duration-150 hover:text-ink-2"
        >
          {linkLabel}
        </Link>
      </div>
    </div>
  )
}
