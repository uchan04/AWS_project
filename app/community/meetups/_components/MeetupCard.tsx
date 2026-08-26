"use client"

import { useEffect, useRef, useState } from "react"
import type { GalleryType, MeetupStatus } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { meetupDateTime } from "../../_lib/format"
import { FadeIn, Spinner } from "./transitions"
import { CancelJoinConfirm } from "./CancelJoinConfirm"

// 전체 갤러리는 종족이 없어 TRIBE에 키가 없다. WriteModal이 같은 이유로 자기 파일에 둔 값을 그대로 쓴다.
const NEUTRAL_COLOR = "#9CA3AF"

// 신청 계열 주 버튼의 배경.
// NEUTRAL_COLOR는 "종족색이 없음"을 뜻하는 부재 표시지 강조색이 아니다. 모든 모임이 ALL인 지금
// galleryColor는 항상 이 회색으로 풀려서, 주 버튼이 눌리지 않는 버튼처럼 보였다.
// 값을 lib/types.ts나 app/globals.css에 두지 않는다 — 둘 다 5인이 공유하는 파일이고(CLAUDE.md 1절)
// 화면 하나 때문에 공유 색 토큰을 늘릴 이유가 없다. WriteModal.tsx가 NEUTRAL_COLOR를
// 자기 파일에 둔 것과 같은 방식이다.
// MeetupList의 결성 완료 표시가 같은 색을 쓴다. 값을 두 곳에 적어두면 한쪽만 바뀐다.
export const MEETUP_ACCENT = "#0F766E"

// 카드 진입의 순차 지연. 상한을 두지 않으면 20번째 카드가 800ms 뒤에 떠서 화면이 느려 보인다.
const ENTER_STEP_MS = 40
const ENTER_MAX_DELAY_MS = 240

// 인원 수 강조가 원래 색으로 돌아가기까지의 시간. 아래 duration-300과 같은 값이다.
const BUMP_MS = 300

// 인라인 펼침 전환. 무산 확인·신청 확인 두 영역이 같은 값을 쓴다(취소 확인은 CancelJoinConfirm이 같은 값을 갖는다).
// 전환만 motion-safe로 감싸고 상태 클래스(max-h/opacity)는 감싸지 않는다 —
// reduced-motion에서는 즉시 열리고 닫히되 움직이지 않아야 한다.
const EXPAND_BASE = "overflow-hidden motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
const EXPAND_CLOSED = "max-h-0 opacity-0"
const EXPAND_PANEL = "flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3"

export type MeetupListItem = {
  id: string
  galleryType: GalleryType
  title: string
  place: string
  startsAt: Date
  minCount: number
  capacity: number
  joinCount: number
  status: MeetupStatus
  host: { nickname: string }
  joined: boolean
}

// 어떤 요청이 진행 중인지까지 들고 있는다. 스피너는 누른 버튼에만 띄우고, 잠그는 것은 전부다.
// 성공한 뒤 onChanged로 그대로 올려보낸다 — MeetupList가 결성·무산일 때만 완료 표시를 띄운다.
export type MeetupAction = "join" | "leave" | "confirm" | "cancel"
type PendingAction = MeetupAction

// 목록·카드 어디에도 참가자 명단은 없다. 명단은 관리자 전용 API로만 볼 수 있다(SPEC 8절 취지).
export function MeetupCard({
  meetup,
  isAdmin,
  index,
  // "지금"은 서버가 한 번 찍어 내려준다. 렌더 중에 Date.now()를 부르면 순수하지 않아
  // 서버와 하이드레이션 결과가 갈릴 수 있다(react-hooks의 impure function 규칙).
  nowMs,
  onChanged,
}: {
  meetup: MeetupListItem
  isAdmin: boolean
  index: number
  nowMs: number
  // 성공한 동작을 함께 넘긴다. 목록을 다시 읽는 것 외에 결성·무산에는 완료 표시가 따라붙는다.
  onChanged: (action: MeetupAction) => void
}) {
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingJoin, setConfirmingJoin] = useState(false)
  const [choosingReason, setChoosingReason] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [entered, setEntered] = useState(false)
  const [bumped, setBumped] = useState(false)
  const lastJoinCount = useRef(meetup.joinCount)

  // 마운트된 프레임에 최종 상태를 칠하면 전환이 생기지 않는다. 한 프레임 뒤에 올린다.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // joinCount는 router.refresh() 뒤에 새 prop으로 들어온다. 값이 실제로 달라졌을 때만 강조한다.
  useEffect(() => {
    if (lastJoinCount.current === meetup.joinCount) return
    lastJoinCount.current = meetup.joinCount
    setBumped(true)
    const timer = window.setTimeout(() => setBumped(false), BUMP_MS)
    return () => window.clearTimeout(timer)
  }, [meetup.joinCount])

  const tribe = meetup.galleryType === "ALL" ? null : TRIBE[meetup.galleryType]
  const galleryColor = tribe ? tribe.colorHex : NEUTRAL_COLOR

  const isFull = meetup.joinCount >= meetup.capacity
  const shortBy = meetup.minCount - meetup.joinCount

  // "내가 신청한 모임" 구역은 지난 모임과 결성된 모임도 보여준다. 둘 다 더 이상 조작할 게 없다.
  // isPast는 모든 액션을, isConfirmed는 취소만 막는다(확정된 모임은 API도 취소를 거부한다).
  const isPast = meetup.startsAt.getTime() < nowMs
  const isConfirmed = meetup.status === "CONFIRMED"
  const canAct = !isPast
  const canCancel = canAct && !isConfirmed

  // 요청 중에는 모든 버튼을 잠근다. 신청과 취소가 겹쳐 들어가면 joinCount가 어긋난다.
  async function run(
    action: PendingAction,
    path: string,
    method: "POST" | "DELETE",
    options: { grantsAffinity?: boolean; body?: Record<string, unknown> } = {}
  ) {
    if (pending) return
    setPending(action)
    setError(null)
    try {
      const res = await fetch(path, {
        method,
        ...(options.body
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }
          : {}),
      })
      const json = await res.json()
      if (json.error) {
        // API가 내려준 message를 그대로 띄운다(CLAUDE.md 7절 — 화면에 그대로 쓸 한국어 문장이다).
        setError(json.error.message)
        return
      }
      closePanels()
      onChanged(action)
      // 신규 신청에만 친밀도가 붙는다. 헤더의 재화 표시를 갱신하라고 알린다(WriteModal과 같은 이벤트).
      if (options.grantsAffinity) window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } finally {
      setPending(null)
    }
  }

  function closePanels() {
    setConfirmingJoin(false)
    setChoosingReason(false)
    setConfirmingCancel(false)
  }

  const BUTTON_BASE =
    "inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-40"
  const QUIET_BUTTON = BUTTON_BASE + " border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"

  return (
    // 진입 전환은 바깥 겹에서 300ms로, hover 반응은 안쪽 카드에서 150ms로 나눠 건다.
    // 한 겹에 몰면 두 전환이 같은 duration을 공유해 hover가 굼떠진다.
    <div
      className={
        "transition duration-300 ease-out " + (entered ? "" : "motion-safe:translate-y-2 motion-safe:opacity-0")
      }
      style={{ transitionDelay: `${Math.min(index * ENTER_STEP_MS, ENTER_MAX_DELAY_MS)}ms` }}
    >
      {/* 카드가 여러 개 나열되므로 scale은 쓰지 않는다(격자가 흔들린다). 그림자 한 단계 + 2px 부양만 — PostCard.tsx와 같다. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 transition duration-150 hover:border-neutral-300 hover:shadow-md motion-safe:hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-neutral-900">{meetup.title}</p>
            <p className="mt-1 text-xs text-neutral-400">{meetup.host.nickname}</p>
          </div>

          {/* 배지 어휘는 카드에 있던 종족 배지와 같다 — 알약 모양에 22 알파 배경, 원색 글자.
              지난 모임이 결성된 모임보다 앞선다. 지나갔으면 결성 여부는 이제 중요하지 않다. */}
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

        <div className="flex flex-col gap-1 text-sm text-neutral-600">
          <span>{meetupDateTime(meetup.startsAt)}</span>
          <span>{meetup.place}</span>
          {/* 강조는 inline-block 안에서만 일어난다. 줄 높이도 이웃 요소도 밀지 않는다.
              글자 굵기는 건드리지 않는다 — 폭이 바뀌어 숫자가 흔들린다. */}
          <span>
            <span
              className={
                "inline-block transition duration-300 " +
                (bumped ? "text-neutral-900 motion-safe:scale-110" : "text-neutral-500")
              }
            >
              {meetup.joinCount} / {meetup.capacity}명
            </span>
          </span>
        </div>

        {error && (
          <FadeIn key={error} className="block text-xs text-red-500">
            {error}
          </FadeIn>
        )}

        <div className="flex flex-wrap gap-2">
          {meetup.joined && canCancel && (
            <button
              type="button"
              onClick={() => setChoosingReason(true)}
              disabled={pending !== null || choosingReason}
              className={QUIET_BUTTON}
            >
              {pending === "leave" && <Spinner />}
              {/* key를 함께 바꿔야 다시 마운트되어 opacity 전환이 보인다. */}
              <FadeIn key="leave">신청 취소</FadeIn>
            </button>
          )}

          {/* 관리자는 신청 대상이 아니다. "신청하기"도 "정원 마감" 비활성 표시도 렌더하지 않는다.
              이 변경 전에 이미 신청해둔 관리자는 위 "신청 취소"로 빠질 수 있다. */}
          {!meetup.joined && !isAdmin && canAct && (
            <button
              type="button"
              onClick={() => setConfirmingJoin(true)}
              disabled={pending !== null || isFull || confirmingJoin}
              className={BUTTON_BASE + " text-white"}
              // 정원이 찬 버튼은 지금의 회색(galleryColor)을 그대로 둔다 — 거기서는 회색이 맞다.
              // galleryColor는 종족 모임을 되살릴 때 다시 쓸 값이라 남겨둔다.
              style={{ backgroundColor: isFull ? galleryColor : MEETUP_ACCENT }}
            >
              {pending === "join" && <Spinner />}
              <FadeIn key={isFull ? "full" : "join"}>{isFull ? "정원 마감" : "신청하기"}</FadeIn>
            </button>
          )}

          {isAdmin && canAct && (
            <>
              <button
                type="button"
                onClick={() => run("confirm", `/api/community/meetups/${meetup.id}/confirm`, "POST")}
                disabled={pending !== null || shortBy > 0}
                className={BUTTON_BASE + " border border-neutral-900 bg-neutral-900 text-white"}
              >
                {pending === "confirm" && <Spinner />}
                결성 확인
              </button>
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                disabled={pending !== null || confirmingCancel}
                className={QUIET_BUTTON + " text-neutral-500"}
              >
                무산
              </button>
            </>
          )}
        </div>

        {isAdmin && canAct && shortBy > 0 && <p className="text-xs text-neutral-400">{shortBy}명 더 모이면 결성돼요</p>}

        {/* 신청 확인. 무게는 전하되 압박하지 않는다 — 오실 수 있는지 되묻거나 책임을 말하지 않는다.
            관리자에게는 여는 버튼이 없으므로 영역 자체를 렌더 트리에 넣지 않는다. */}
        {!isAdmin && canAct && (
          <div
            aria-hidden={!confirmingJoin}
            className={EXPAND_BASE + " " + (confirmingJoin ? "max-h-96 opacity-100" : EXPAND_CLOSED)}
          >
            <div className={EXPAND_PANEL}>
              <p className="text-sm font-semibold text-neutral-900">오프라인에서 만나는 약속이에요</p>
              <p className="text-xs leading-relaxed text-neutral-600">
                서로 시간을 내어 같은 자리에 모이는 일이에요.
                <br />
                지금 정하지 않아도 괜찮으니, 갈 수 있을 때 신청해 주세요.
              </p>

              {/* 날짜·장소를 다시 적지 않는다(2026-08-27). 바로 위 카드 본문에 같은 두 줄이
                  이미 있고, 펼침이 그것을 덮지도 않는다 — 같은 화면에서 두 번 읽히면 확인
                  영역이 길어지기만 한다 */}

              <p className="text-xs text-neutral-400">신청한 뒤에도 언제든 취소할 수 있어요.</p>

              {/* 왼쪽이 되돌리는 쪽, 오른쪽이 실행이다 — 취소 확인(CancelJoinConfirm)과 같은 순서를 쓴다.
                  뒤집으면 습관으로 누르던 사람이 뜻하지 않은 쪽을 누르게 된다 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closePanels}
                  disabled={!confirmingJoin || pending !== null}
                  className={QUIET_BUTTON}
                >
                  조금 더 생각해볼게요
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run("join", `/api/community/meetups/${meetup.id}/join`, "POST", { grantsAffinity: true })
                  }
                  disabled={!confirmingJoin || pending !== null}
                  className={BUTTON_BASE + " text-white"}
                  style={{ backgroundColor: MEETUP_ACCENT }}
                >
                  {pending === "join" && <Spinner />}
                  신청할게요
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 취소 확인. 나의 신청 현황 모달과 **같은 컴포넌트**를 쓴다(CancelJoinConfirm).
            2026-08-27 이전에는 여기에 사유 칩과 한 줄 입력이 있었는데, 취소하려는 사람에게
            이유를 묻는 자리를 없앴다. 사유를 보내지 않으면 서버는 cancelReason을 null로 둔다 */}
        {canCancel && (
          <CancelJoinConfirm
            open={choosingReason}
            pending={pending !== null}
            onKeep={closePanels}
            onConfirm={() => run("leave", `/api/community/meetups/${meetup.id}/join`, "DELETE")}
          />
        )}

        {isAdmin && canAct && (
          // window.confirm은 쓰지 않는다. 높이·투명도를 함께 전환하려고 항상 렌더해 두고
          // max-h로 접는다. 접혀 있는 동안에는 버튼을 disabled로 둬서 탭 이동에도 잡히지 않는다.
          <div
            aria-hidden={!confirmingCancel}
            className={EXPAND_BASE + " " + (confirmingCancel ? "max-h-48 opacity-100" : EXPAND_CLOSED)}
          >
            <div className={EXPAND_PANEL}>
              <p className="text-xs leading-relaxed text-neutral-600">
                {meetup.joinCount === 0
                  ? "신청자가 없는 모임입니다. 무산시키면 되돌릴 수 없어요."
                  : `${meetup.joinCount}명이 신청한 모임입니다. 무산시키면 되돌릴 수 없어요.`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => run("cancel", `/api/community/meetups/${meetup.id}`, "DELETE")}
                  disabled={!confirmingCancel || pending !== null}
                  className={BUTTON_BASE + " bg-red-500 text-white hover:bg-red-600"}
                >
                  {pending === "cancel" && <Spinner />}
                  무산하기
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  disabled={!confirmingCancel || pending !== null}
                  className={QUIET_BUTTON}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
