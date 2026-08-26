"use client"

import { useEffect, useRef, useState } from "react"
import { useModalA11y } from "@/app/components/useModalA11y"

/**
 * 커뮤니티 이용 규칙. 트리거 버튼과 모달을 한 컴포넌트에 담는다(`WriteModal`과 같은 구조).
 *
 * 처음 들어온 사람에게 한 번 자동으로 뜨고, 그 뒤로는 "이용 규칙" 버튼으로 언제든 다시 본다.
 *
 * **이 프로젝트에서 localStorage를 쓰는 첫 자리다.** `ChatLauncher`가 말풍선 닫힘을
 * localStorage에 남기지 않기로 한 것과 충돌하지 않는다 — 성격이 반대다.
 *
 *   챗봇 말풍선: 닫힘을 영구히 기억하면 **다시 말 걸 길이 없어진다.** 한 번 닫은 사람에게
 *     영영 말을 안 거는 것이 그 기능의 실패다. 그래서 화면을 떠날 때까지만 기억한다.
 *   이용 규칙: 한 번 보면 **다시 안 봐도 되는** 성격이고, 못 봤거나 잊었어도 헤더의
 *     "이용 규칙" 버튼이 항상 있어서 놓쳐도 잃는 것이 없다. 매번 띄우는 쪽이 오히려
 *     방해가 된다.
 *
 * 기기·브라우저마다 다시 뜨는 것도 여기서는 손해가 아니다(새 기기에서 한 번 더 보는 것뿐).
 */

/**
 * localStorage 키. 이 프로젝트에 기존 규칙이 없어 여기서 정한다 —
 * `<앱>.<영역>.<무엇>` 꼴이다. 값은 본 시각(ISO)이고, **존재 여부만 본다.**
 */
const STORAGE_KEY = "welli.community.rulesSeen"

/**
 * 규칙 본문. **한 곳에만 둔다** — 나중에 규칙을 고칠 때 여기만 고치면 된다.
 *
 * 2번을 빼거나 순서를 내리지 않는다. 금지 조항만 나열하면 힘든 이야기를 꺼내기
 * 어려워지고, 그게 이 서비스에서 가장 큰 손실이다(`lib/safety.ts`가 욕설 자체를
 * 막지 않는 것과 같은 판단이다).
 */
const RULES = [
  "서로를 향한 욕설과 비하는 삭제됩니다",
  "힘든 이야기는 얼마든지 하셔도 괜찮아요",
  "정치·종교 이야기는 자제해 주세요. 서로 마음이 상하기 쉬워요",
  "다른 사람의 이야기를 밖으로 옮기지 마세요",
  "규칙을 어긴 글은 관리자가 삭제하고 알려드립니다",
]

export function RulesModal() {
  // localStorage를 읽기 전에는 **모달만** 그리지 않는다. 버튼은 늘 그린다 —
  // 버튼까지 미루면 한 프레임 뒤에 나타나 헤더가 밀린다(레이아웃 이동).
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  // 자동으로 열린 경우에만 닫을 때 키를 찍는다. 버튼으로 연 것은 "처음 봄"이 아니다.
  const autoOpenedRef = useRef(false)

  // 렌더 중에 setState하지 않으려고 한 프레임 뒤에 읽는다(react-hooks/set-state-in-effect).
  // MeetupNotice가 진입 전환을 올릴 때 쓰는 방식과 같다.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let seen = true
      try {
        seen = window.localStorage.getItem(STORAGE_KEY) !== null
      } catch {
        // 시크릿 모드·저장소 차단. 읽지 못하면 "이미 봤다"로 둔다 —
        // 실패를 "안 봤다"로 보면 그런 환경에서 페이지를 열 때마다 뜬다.
        seen = true
      }

      if (!seen) {
        autoOpenedRef.current = true
        setOpen(true)
      }
      setReady(true)
    })

    return () => cancelAnimationFrame(frame)
  }, [])

  function close() {
    // 자동으로 뜬 것을 닫은 순간이 "봤다"는 뜻이다. 버튼으로 연 것은 키를 건드리지 않는다.
    if (autoOpenedRef.current) {
      try {
        window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
      } catch {
        // 저장하지 못하면 다음에 또 뜬다. 화면이 죽는 것보다 낫다.
      }
      autoOpenedRef.current = false
    }
    setOpen(false)
  }

  // 삭제 통보(DeletedNoticeDialog)와 반대로 **닫는 길을 다 열어둔다** — X·배경 클릭·Escape.
  // 안 읽어도 잃는 것이 없고 버튼으로 다시 볼 수 있어서, 붙잡아 둘 이유가 없다.
  // 그래서 빈 함수가 아니라 진짜 close를 넘긴다.
  const boxRef = useModalA11y(close, open)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 주 CTA("글 쓰기") 옆이라 조용하게 둔다. 채움 배경을 쓰지 않는다.
        className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-600 transition duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        이용 규칙
      </button>

      {ready && open && (
        // 껍데기·치수는 DeletedNoticeDialog와 같다. z-50은 ChatLauncher(z-40) 위다.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" onClick={close}>
          <div
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-rules-title"
            tabIndex={-1}
            className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                {/* 경고가 아니라 환영이다. 규칙을 읽는 첫 문장이 겁을 주면 안 된다 */}
                <h2 id="community-rules-title" className="text-base font-bold text-neutral-900">
                  여기는 편하게 이야기하는 곳이에요
                </h2>
                <p className="mt-1 text-sm text-neutral-500">함께 쓰는 공간이라 몇 가지만 약속해요.</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="이용 규칙 창 닫기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            <ol className="flex flex-col gap-2">
              {RULES.map((rule, index) => (
                <li key={rule} className="flex items-start gap-3 rounded-xl bg-neutral-50 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-neutral-500">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-neutral-700">{rule}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-bold text-white transition duration-150 hover:bg-neutral-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
