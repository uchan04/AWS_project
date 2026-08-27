"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useModalA11y } from "@/app/components/useModalA11y"
import { meetupDateTime } from "../../_lib/format"
import { MEETUP_ACCENT, type MeetupListItem } from "./MeetupCard"
import { CancelJoinConfirm } from "./CancelJoinConfirm"

/**
 * 나의 신청 현황. 트리거 버튼과 모달을 한 컴포넌트에 담는다(`RulesModal`·`WriteModal`과 같은 구조).
 *
 * **예전에는 페이지 안의 "내가 신청한 모임" 구역이었다(2026-08-27에 옮겼다).** 그 구역 아래로
 * 전체 목록이 헤딩 없이 이어져서, 신청하지 않은 모임까지 그 제목에 속한 것처럼 읽혔다.
 * 목록은 하나로 되돌리고, 내가 무엇을 신청했는지는 이 모달이 맡는다.
 *
 * 목록은 서버(page.tsx)가 이미 읽은 것을 props로 받는다 — 이 창 하나 때문에 API를 새로 부르면
 * 열 때마다 왕복이 붙고, 뒤에 깔린 카드 목록과 다른 시점의 데이터가 섞인다.
 */

// 취소 확인 자체는 `CancelJoinConfirm`이 그린다. 카드(MeetupCard)와 같은 것을 쓴다 —
// 문구와 버튼 배치를 두 벌로 두면 한쪽만 고쳐져 갈라진다(그 파일 주석 참고).
const COMPACT_QUIET =
  "inline-flex items-center rounded-xl border border-rule bg-card px-3 py-1.5 text-xs font-semibold text-ink-2 transition duration-150 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"

// 지난 모임 배지의 회색. MeetupCard의 NEUTRAL_COLOR와 같은 값이다(그쪽도 export되지 않는다).
const NEUTRAL_COLOR = "#9CA3AF"

export function MyJoinsModal({ joined, nowMs }: { joined: MeetupListItem[]; nowMs: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // 확인 펼침은 **한 번에 하나만.** 다른 모임의 취소를 누르면 이전 것이 접힌다 —
  // 두 개가 동시에 열려 있으면 어느 쪽을 지우는 중인지 알 수 없다.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setConfirmingId(null)
    setError(null)
    setOpen(false)
  }

  // 닫는 길을 다 열어둔다 — ✕·배경 클릭·Escape. RulesModal과 같은 판단이다(붙잡아 둘 이유가 없다).
  const boxRef = useModalA11y(close, open)

  async function cancelJoin(meetupId: string) {
    if (pendingId) return
    setPendingId(meetupId)
    setError(null)
    try {
      // 사유는 보내지 않는다. 사유를 고르는 자리는 카드 쪽 취소 흐름에 이미 있고,
      // 여기서까지 물으면 취소를 회피하고 말없이 안 나타나는 쪽으로 흐른다(MeetupCard 주석).
      // API는 body 없는 DELETE를 정상으로 받는다(join/route.ts).
      const res = await fetch(`/api/community/meetups/${meetupId}/join`, { method: "DELETE" })
      const json = await res.json()
      if (json.error) {
        // API가 내려준 message를 그대로 띄운다(CLAUDE.md 7절 — 화면에 그대로 쓸 한국어 문장이다).
        setError(json.error.message)
        return
      }
      setConfirmingId(null)
      // 목록은 서버가 다시 읽어 props로 내려준다. 창은 닫지 않는다 —
      // 여기서 닫으면 무엇이 사라졌는지 확인할 새가 없다.
      router.refresh()
    } catch {
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 주 동작이 아니라 확인하러 가는 길이라 조용하게 둔다(RulesModal 트리거와 같은 어휘).
        className="rounded-xl border border-rule px-4 py-2.5 text-sm font-semibold text-ink-2 transition duration-150 hover:bg-paper focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        나의 신청 현황
      </button>

      {open && (
        // 껍데기·치수는 RulesModal과 같다. z-50은 ChatLauncher(z-40) 위다.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" onClick={close}>
          <div
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-joins-title"
            tabIndex={-1}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 머리는 스크롤하지 않는다. 목록이 길어져도 제목과 닫기는 늘 같은 자리다(WriteModal과 같은 구조) */}
            <div className="flex items-start justify-between gap-3 px-8 pt-8 pb-5">
              <div>
                <h2 id="my-joins-title" className="text-base font-bold text-ink">
                  나의 신청 현황
                </h2>
                <p className="mt-1 text-sm text-muted">신청해 둔 모임이에요.</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="나의 신청 현황 창 닫기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 text-muted hover:bg-rule"
              >
                ✕
              </button>
            </div>

            {/* 여기만 스크롤한다. py-1·scroll-py-2는 포커스 링 자리다(WriteModal 주석 참고) */}
            <div className="flex-1 scroll-py-2 overflow-y-auto px-8 py-1 pb-8">
              {error && (
                <p role="alert" className="mb-3 text-xs text-error">
                  {error}
                </p>
              )}

              {joined.length === 0 ? (
                /* 빈 상태. 아직 아무것도 안 한 사람을 재촉하지 않는다 — 지금 신청하라고 말하지 않는다 */
                <p className="py-12 text-center text-sm leading-relaxed text-muted">
                  아직 신청한 모임이 없어요.
                  <br />
                  마음이 가는 모임이 생기면 그때 신청해도 괜찮아요.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {joined.map((meetup) => {
                    // 판정 기준은 카드와 같다 — 지난 모임은 손댈 것이 없고,
                    // 확정된 모임은 API도 취소를 거부한다(join/route.ts의 DELETE).
                    const isPast = meetup.startsAt.getTime() < nowMs
                    const isConfirmed = meetup.status === "CONFIRMED"
                    const canCancel = !isPast && !isConfirmed
                    const confirming = confirmingId === meetup.id

                    return (
                      <li key={meetup.id} className="rounded-card border border-rule bg-paper p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium break-words text-ink">{meetup.title}</p>
                            <p className="mt-1 text-xs text-muted">{meetupDateTime(meetup.startsAt)}</p>
                            <p className="text-xs break-words text-muted">{meetup.place}</p>
                          </div>

                          {/* 배지 어휘는 카드와 같다 — 알약 모양에 22 알파 배경, 원색 글자 */}
                          {(isPast || isConfirmed) && (
                            <span
                              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                              style={
                                isPast
                                  ? { backgroundColor: `${NEUTRAL_COLOR}22`, color: NEUTRAL_COLOR }
                                  : { backgroundColor: `${MEETUP_ACCENT}22`, color: MEETUP_ACCENT }
                              }
                            >
                              {isPast ? "지난 모임" : "결성됨"}
                            </span>
                          )}
                        </div>

                        {canCancel ? (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => setConfirmingId(meetup.id)}
                              disabled={pendingId !== null || confirming}
                              className={COMPACT_QUIET}
                            >
                              신청 취소
                            </button>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs leading-relaxed text-muted">
                            {isPast
                              ? "이미 지난 모임이에요."
                              : "결성된 모임이라 여기서는 취소할 수 없어요. 사정이 생겼다면 관리자에게 알려주세요."}
                          </p>
                        )}

                        {canCancel && (
                          <CancelJoinConfirm
                            open={confirming}
                            pending={pendingId !== null}
                            onKeep={() => setConfirmingId(null)}
                            onConfirm={() => cancelJoin(meetup.id)}
                            // 항목 자체가 회색(bg-paper)이라 패널은 흰 바탕으로 띄운다
                            panelClassName="mt-3 flex flex-col gap-2 rounded-xl border border-rule bg-card p-3"
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
