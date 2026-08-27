"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MEETUP_ACCENT, MeetupCard, type MeetupAction, type MeetupListItem } from "./MeetupCard"
import { MeetupCreateModal } from "./MeetupCreateModal"

/*
 * 관리자가 결성 확인·무산을 누른 직후 이 화면에 뜨는 완료 표시.
 * 신청자에게 보이는 MeetupNotice 배너와는 다른 것이다 — 저쪽은 "내 모임이 결성됐다"는 알림이고,
 * 이쪽은 "방금 누른 것이 처리됐다"는 관리자 확인이다. 두 배너를 하나로 합치지 않는다.
 */
type MeetupNoticeState = {
  // 같은 동작을 연달아 해도 새 표시로 다시 뜨게 하는 키. 이게 없으면 React가 DOM을 재사용해 전환이 안 보인다.
  seq: number
  action: Extract<MeetupAction, "confirm" | "cancel">
  title: string
}

// 표시가 저절로 사라지기까지의 시간.
const NOTICE_MS = 4000

// 나타남·사라짐 전환 길이. transitions.tsx의 FadeIn과 같은 200ms를 쓴다 — 이 화면의 전환 값을
// 늘리지 않는다. 사라질 때는 이 시간만큼 언마운트를 미뤄야 전환이 보인다.
const NOTICE_TRANSITION_MS = 200

/**
 * page.tsx는 서버 컴포넌트라 router.refresh()를 못 부른다. 신청·취소·결성확인·무산 뒤에
 * 목록을 다시 읽으려면 클라이언트 경계가 하나 필요해서 PostList와 같은 자리에 이 파일을 뒀다.
 */
export function MeetupList({
  meetups,
  isAdmin,
  // 서버가 찍은 "지금". 카드가 지난 모임을 판정하는 데 쓴다(MeetupCard 주석 참고).
  nowMs,
  // "내가 신청한 모임" 구역이 이 목록을 그대로 재사용한다. 거기서는 개설 버튼이 나오면 안 된다.
  showCreateButton = true,
}: {
  meetups: MeetupListItem[]
  isAdmin: boolean
  nowMs: number
  showCreateButton?: boolean
}) {
  const router = useRouter()
  const [notice, setNotice] = useState<MeetupNoticeState | null>(null)
  const [noticeShown, setNoticeShown] = useState(false)
  const hideTimer = useRef<number | null>(null)
  const unmountTimer = useRef<number | null>(null)
  const noticeSeq = useRef(0)

  function clearTimers() {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    if (unmountTimer.current !== null) window.clearTimeout(unmountTimer.current)
    hideTimer.current = null
    unmountTimer.current = null
  }

  // 언마운트될 때 남은 타이머를 정리한다. 남겨두면 사라진 컴포넌트에 setState가 걸린다.
  useEffect(() => {
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
      if (unmountTimer.current !== null) window.clearTimeout(unmountTimer.current)
    }
  }, [])

  // 마운트된 프레임에 최종 상태를 칠하면 전환이 생기지 않는다. 한 프레임 뒤에 올린다.
  useEffect(() => {
    if (!notice) return
    const frame = requestAnimationFrame(() => setNoticeShown(true))
    return () => cancelAnimationFrame(frame)
  }, [notice])

  function hideNotice() {
    // 이전 타이머를 먼저 끈다. 그대로 두면 앞선 표시의 타이머가 방금 띄운 표시를 지운다.
    clearTimers()
    setNoticeShown(false)
    unmountTimer.current = window.setTimeout(() => {
      unmountTimer.current = null
      setNotice(null)
    }, NOTICE_TRANSITION_MS)
  }

  function showNotice(action: MeetupNoticeState["action"], title: string) {
    clearTimers()
    noticeSeq.current += 1
    setNoticeShown(false)
    setNotice({ seq: noticeSeq.current, action, title })
    hideTimer.current = window.setTimeout(hideNotice, NOTICE_MS)
  }

  function handleChanged(action: MeetupAction, title: string) {
    // 신청·취소는 신청자 본인의 동작이라 완료 표시를 띄우지 않는다. 관리자 조작만 알린다.
    if (action === "confirm" || action === "cancel") showNotice(action, title)
    router.refresh()
  }

  const isConfirmNotice = notice?.action === "confirm"

  return (
    <>
      {notice && (
        <div
          key={notice.seq}
          role="status"
          className={
            "flex items-start justify-between gap-3 rounded-card border px-4 py-3 transition duration-200 ease-out " +
            (noticeShown ? "" : "motion-safe:-translate-y-2 motion-safe:opacity-0") +
            // 결성은 강조색, 무산은 중립 회색. 무산은 알리되 축하할 일이 아니다.
            (isConfirmNotice ? "" : " border-rule bg-paper-2 text-ink-2")
          }
          style={
            isConfirmNotice
              ? {
                  // 카드 배지와 같은 어휘 — 강조색에 22 알파 배경, 원색 글자.
                  backgroundColor: `${MEETUP_ACCENT}14`,
                  borderColor: `${MEETUP_ACCENT}33`,
                  color: MEETUP_ACCENT,
                }
              : undefined
          }
        >
          <p className="text-sm leading-relaxed font-medium">
            &lsquo;{notice.title}&rsquo; 모임이 {isConfirmNotice ? "결성" : "무산"}되었어요. 신청자에게 알림이
            전달됩니다.
          </p>
          <button
            type="button"
            onClick={hideNotice}
            aria-label="알림 닫기"
            className="shrink-0 rounded-full px-1.5 text-sm opacity-60 transition duration-150 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 일반 유저에게는 개설 버튼도 모달도 렌더 트리에 넣지 않는다. 서버도 isAdmin을 다시 확인한다. */}
      {isAdmin && showCreateButton && (
        <div className="flex justify-end">
          <MeetupCreateModal onCreated={() => router.refresh()} />
        </div>
      )}

      {meetups.length === 0 ? (
        <p className="py-24 text-center text-sm leading-relaxed text-muted">
          아직 열린 모임이 없어요.
          <br />
          모임이 열리면 여기에서 안내할게요.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
          {meetups.map((meetup, index) => (
            <MeetupCard
              key={meetup.id}
              meetup={meetup}
              isAdmin={isAdmin}
              // 진입 전환의 순차 지연에만 쓴다. 카드 내용은 index에 의존하지 않는다.
              index={index}
              nowMs={nowMs}
              // 무산된 모임은 refresh 뒤 목록에서 사라진다. 제목을 여기서 붙들어 표시에 넘긴다.
              onChanged={(action) => handleChanged(action, meetup.title)}
            />
          ))}
        </div>
      )}
    </>
  )
}
