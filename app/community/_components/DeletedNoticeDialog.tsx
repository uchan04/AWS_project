"use client"

import { useEffect, useState } from "react"
import { useModalA11y } from "@/app/components/useModalA11y"
import type { DeletedNoticeItem } from "../_lib/deleteNotice"

/**
 * 관리자 삭제 통보 팝업. `app/layout.tsx`에 얹혀 **어느 화면에서든** 뜬다(E 담당).
 *
 * 그래서 모임 배너(`MeetupNotice`)와 달리 서버에서 prop으로 받지 않고 스스로 GET 한다.
 * 레이아웃은 클라이언트 이동으로 다시 마운트되지 않으므로 전체 로드당 한 번만 부른다.
 *
 * **확인 버튼 하나뿐이다.** X도 배경 클릭도 없고, `useModalA11y`에 빈 함수를 넘겨
 * Escape도 닫지 않는다 — 안 읽고 흘려보내면 다음 접속마다 계속 뜨는 알림이라
 * "읽음 처리 없이 사라지는 길"을 만들면 안 된다. 훅은 그대로 쓰므로 초점 가두기·
 * 배경 스크롤 잠금·닫을 때 초점 복귀는 다른 모달과 같게 동작한다.
 *
 * 어떤 표현이 문제였는지는 **보여주지 않는다**(우회 학습 방지). 서버도 그 정보를
 * 내려주지 않는다(`_lib/deleteNotice.ts`).
 */
export function DeletedNoticeDialog() {
  const [notices, setNotices] = useState<DeletedNoticeItem[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 읽음 처리가 성공한 뒤에만 true가 된다. 실패하면 팝업이 남는다.
  const [done, setDone] = useState(false)

  // 미인증(401)·조회 실패·빈 목록이면 아무것도 하지 않는다. 로딩 중에도 그리지 않는다 —
  // 빈 껍데기를 먼저 띄우면 대부분의 접속에서 깜빡임만 남는다.
  useEffect(() => {
    let ignore = false

    fetch("/api/community/notices/deleted")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (ignore) return
        const list = json?.data?.notices
        if (Array.isArray(list) && list.length > 0) setNotices(list)
      })
      .catch(() => {
        // 조용히 넘어간다. 이 팝업이 못 떴다고 알릴 이유가 없다
      })

    return () => {
      ignore = true
    }
  }, [])

  const open = notices.length > 0 && !done
  // 빈 함수를 넘긴다 — Escape로 닫히면 읽음 처리 없이 사라진다(위 주석).
  // 두 번째 인자로 open을 주지 않으면 팝업이 없는 화면에서도 배경 스크롤이 잠긴다.
  const boxRef = useModalA11y(() => {}, open)

  if (!open) return null

  async function handleConfirm() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/community/notices/deleted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 종류별로 나눠 보낸다. 라우트가 Post·Comment를 각각 updateMany로 처리한다.
        body: JSON.stringify({
          postIds: notices.filter((notice) => notice.kind === "POST").map((notice) => notice.id),
          commentIds: notices.filter((notice) => notice.kind === "COMMENT").map((notice) => notice.id),
        }),
      })
      const json = await res.json()
      if (json.error) {
        // 실패하면 팝업을 그대로 둔다. 닫아버리면 읽음 처리가 안 된 채 알림만 사라진다
        // (MeetupNotice가 같은 판단을 한다).
        setError(json.error.message)
        return
      }
      setDone(true)
    } catch {
      setError("확인 처리에 실패했어요. 잠시 후 다시 눌러주세요.")
    } finally {
      setPending(false)
    }
  }

  const hasPost = notices.some((notice) => notice.kind === "POST")
  const hasComment = notices.some((notice) => notice.kind === "COMMENT")
  const what = hasPost && hasComment ? "글과 댓글이" : hasComment ? "댓글이" : "글이"

  return (
    // 배경에 onClick을 달지 않는다. 확인 버튼만이 닫는 길이다.
    // z-50은 다른 모달과 같은 층이다. ChatLauncher(z-40) 위에 온다.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deleted-notice-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-3xl bg-card p-8 shadow-2xl"
      >
        <h2 id="deleted-notice-title" className="text-base font-bold text-ink">
          작성하신 {what} 커뮤니티 이용규칙에 따라 삭제되었어요
        </h2>

        <ul className="mt-4 flex flex-col gap-2">
          {notices.map((notice) => (
            <li
              key={`${notice.kind}-${notice.id}`}
              className="flex items-start gap-2 rounded-xl border border-rule bg-paper p-3"
            >
              <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-muted">
                {notice.kind === "POST" ? "글" : "댓글"}
              </span>
              {/* 댓글은 title이 "달렸던 글의 제목"이다. 그게 문구로 드러나야 한다 */}
              <span className="min-w-0 text-sm leading-relaxed break-words text-ink-2">
                {notice.kind === "POST" ? notice.title : `'${notice.title}'에 남긴 댓글`}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          커뮤니티는 그대로 이용하실 수 있어요. 다시 이야기를 올리셔도 괜찮아요.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-xs text-error">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex items-center rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-accent-ink transition duration-150 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
