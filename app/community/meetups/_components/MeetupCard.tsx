"use client"

import { useEffect, useRef, useState } from "react"
import type { GalleryType, MeetupStatus } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { meetupDateTime } from "../../_lib/format"
import { FadeIn, Spinner } from "./transitions"

// 전체 갤러리는 종족이 없어 TRIBE에 키가 없다. WriteModal이 같은 이유로 자기 파일에 둔 값을 그대로 쓴다.
const NEUTRAL_COLOR = "#9CA3AF"

// 카드 진입의 순차 지연. 상한을 두지 않으면 20번째 카드가 800ms 뒤에 떠서 화면이 느려 보인다.
const ENTER_STEP_MS = 40
const ENTER_MAX_DELAY_MS = 240

// 인원 수 강조가 원래 색으로 돌아가기까지의 시간. 아래 duration-300과 같은 값이다.
const BUMP_MS = 300

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
type PendingAction = "join" | "leave" | "confirm" | "cancel"

// 목록·카드 어디에도 참가자 명단은 없다. 명단은 관리자 전용 API로만 볼 수 있다(SPEC 8절 취지).
export function MeetupCard({
  meetup,
  isAdmin,
  index,
  onChanged,
}: {
  meetup: MeetupListItem
  isAdmin: boolean
  index: number
  onChanged: () => void
}) {
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [error, setError] = useState<string | null>(null)
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
  const galleryLabel = tribe ? tribe.family : "전체"

  const isFull = meetup.joinCount >= meetup.capacity
  const shortBy = meetup.minCount - meetup.joinCount

  // 요청 중에는 모든 버튼을 잠근다. 신청과 취소가 겹쳐 들어가면 joinCount가 어긋난다.
  async function run(action: PendingAction, path: string, method: "POST" | "DELETE", grantsAffinity = false) {
    if (pending) return
    setPending(action)
    setError(null)
    try {
      const res = await fetch(path, { method })
      const json = await res.json()
      if (json.error) {
        // API가 내려준 message를 그대로 띄운다(CLAUDE.md 7절 — 화면에 그대로 쓸 한국어 문장이다).
        setError(json.error.message)
        return
      }
      setConfirmingCancel(false)
      onChanged()
      // 신규 신청에만 친밀도가 붙는다. 헤더의 재화 표시를 갱신하라고 알린다(WriteModal과 같은 이벤트).
      if (grantsAffinity) window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } finally {
      setPending(null)
    }
  }

  const BUTTON_BASE =
    "inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-40"

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

          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: `${galleryColor}22`, color: galleryColor }}
          >
            {galleryLabel}
          </span>
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
          {meetup.joined ? (
            <button
              type="button"
              onClick={() => run("leave", `/api/community/meetups/${meetup.id}/join`, "DELETE")}
              disabled={pending !== null}
              className={BUTTON_BASE + " border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"}
            >
              {pending === "leave" && <Spinner />}
              {/* key를 함께 바꿔야 신청↔취소 교체 때 다시 마운트되어 opacity 전환이 보인다. */}
              <FadeIn key="leave">신청 취소</FadeIn>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => run("join", `/api/community/meetups/${meetup.id}/join`, "POST", true)}
              disabled={pending !== null || isFull}
              className={BUTTON_BASE + " text-white"}
              style={{ backgroundColor: galleryColor }}
            >
              {pending === "join" && <Spinner />}
              <FadeIn key={isFull ? "full" : "join"}>{isFull ? "정원 마감" : "신청하기"}</FadeIn>
            </button>
          )}

          {isAdmin && (
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
                className={BUTTON_BASE + " border border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50"}
              >
                무산
              </button>
            </>
          )}
        </div>

        {isAdmin && shortBy > 0 && <p className="text-xs text-neutral-400">{shortBy}명 더 모이면 결성돼요</p>}

        {isAdmin && (
          // window.confirm은 쓰지 않는다. 높이·투명도를 함께 전환하려고 항상 렌더해 두고
          // max-h로 접는다. 접혀 있는 동안에는 버튼을 disabled로 둬서 탭 이동에도 잡히지 않는다.
          <div
            aria-hidden={!confirmingCancel}
            className={
              "overflow-hidden motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out " +
              (confirmingCancel ? "max-h-48 opacity-100" : "max-h-0 opacity-0")
            }
          >
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
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
                  className={BUTTON_BASE + " border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"}
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
