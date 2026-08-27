"use client"

import { useState } from "react"
import { useModalA11y } from "@/app/components/useModalA11y"

/**
 * 재화 세 가지(씨앗·친밀도·별조각)의 획득 방법 안내. 트리거(ⓘ)와 모달을 한 컴포넌트에 담는다
 * (`RulesModal`과 같은 구조). 사이드바 프로필 카드의 우측 상단에 놓인다.
 *
 * 상태를 여기서 들고 있는 이유: `Sidebar.tsx`는 다른 팀원 소유라 그 파일에 useState를 늘리지
 * 않기로 했다. 그쪽 diff는 import 한 줄과 이 태그 한 줄뿐이다.
 *
 * **숫자를 상수로 import하지 않고 문구에 직접 적는다(2026-08-27, 사용자 결정).** 값의 출처는
 * `lib/pet.ts`·`lib/missions/*`·`prisma/seed/missions.ts`인데 전부 다른 팀원 소유라
 * 화면 하나 때문에 그쪽에 의존을 만들지 않는다. 대신 아래 각 줄에 출처를 적어 두었으니
 * 규칙이 바뀌면 그 파일을 보고 여기 숫자를 고친다.
 *
 * 친밀도 절은 **ChatPanel의 ℹ 패널에 있던 문구를 그대로 옮긴 것이다.** 새로 쓰지 않는다
 * (2026-08-27에 AffinityInfoModal을 거쳐 여기로 합쳤다 — 카드에 ⓘ가 둘이면 중복이다).
 *
 * **팝오버가 아니라 모달이다.** 사이드바가 240px(접히면 64px)이라 세 재화 설명이 들어가지
 * 않고, 사이드바 안의 스크롤 영역과 팝오버 좌표가 어긋난다. 껍데기는 같은 파일의
 * "내 계정" 모달 어휘를 따른다(rgba(42,31,20,0.45) 위에 흰 카드).
 *
 * 순서는 **씨앗 → 친밀도 → 별조각**으로, 사이드바 카드의 표시 순서와 같게 맞춘다.
 * 화면에서 본 순서와 설명의 순서가 다르면 눈이 한 번 더 훑는다.
 *
 * 어조: 대상이 고립 청년이다. 매일 하라거나 놓치면 손해라는 뉘앙스를 넣지 않는다.
 * 상한(최대 100 / 오늘 최대 40·60)은 "여기까지만 하면 된다"는 안심 쪽으로 읽히게 둔다.
 */
export function CurrencyInfoModal() {
  const [open, setOpen] = useState(false)

  function close() {
    setOpen(false)
  }

  // 닫는 길을 다 열어둔다 — ✕·배경 클릭·Escape(RulesModal과 같은 판단이다).
  const boxRef = useModalA11y(close, open)

  return (
    <>
      {/* 카드 첫 줄(아바타+닉네임)이 이미 flex라 marginLeft:auto만으로 우측 상단에 놓인다.
          카드 최상위 div에 position을 더하지 않으려고 이 방식을 쓴다 — 그 파일은 남의 것이다.
          색·크기는 그 화면의 흐린 글자(#9A8A76, 11px) 어휘를 따른다 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="재화 안내"
        style={{
          marginLeft: "auto",
          alignSelf: "flex-start",
          padding: 0,
          border: "none",
          background: "none",
          color: "#9A8A76",
          fontSize: 12,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ⓘ
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(42,31,20,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={close}
        >
          <div
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="currency-info-title"
            tabIndex={-1}
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="currency-info-title" className="text-base font-bold text-ink">
                재화는 이렇게 모여요
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="재화 안내 창 닫기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 text-muted hover:bg-rule"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs text-ink-2">
              {/* 씨앗. **다섯 경로를 다 적는다(2026-08-27).** 한때 셋으로 줄였다가 되돌렸다 —
                  빠졌던 단계 미션(+22~58)과 펫 외출(+30~50)이 남긴 셋보다 수급량이 커서,
                  줄인 목록이 "이렇게 조금씩 모인다"는 잘못된 인상을 줬다.
                  출처: 미션 +10~15 prisma/seed/missions.ts · 단계 미션 +22~58 lib/missions/bands.ts
                  (rewardForStage의 18+band*4) · 외출 +30~50 lib/pet.ts(OUTING_REWARD_MIN/MAX) ·
                  시간당 +2와 최대 100 lib/pet.ts(IDLE_SEEDS_PER_HOUR·IDLE_MAX_SEEDS) ·
                  출석 +10~40 lib/missions/attendance.ts */}
              <section>
                <p className="mb-2 font-semibold text-ink-2">🌱 씨앗</p>
                <ul className="flex flex-col gap-1">
                  <li>미션을 하나 마치면 +10~15</li>
                  <li>단계 미션을 올라가면 +22~58</li>
                  <li>펫 외출에서 +30~50</li>
                  <li>시간이 지나면 저절로 +2씩 (최대 100까지 모여요)</li>
                  <li>출석하면 +10~40</li>
                </ul>
              </section>

              {/* 친밀도. ChatPanel의 ℹ 패널 문구를 그대로 옮겼다. 수치 출처는 app/community/_lib/affinity.ts */}
              <section>
                <p className="mb-2 font-semibold text-ink-2">❤️ 친밀도</p>
                <ul className="flex flex-col gap-1">
                  <li>챗봇 대화 1턴 +5 · 오늘 최대 40</li>
                  <li>커뮤니티 글 작성 +20</li>
                  <li>댓글 달기 +5</li>
                  <li>오프라인 모임 신청 +10</li>
                  <li className="text-muted">위 세 가지(커뮤니티)는 오늘 최대 60</li>
                </ul>
                <p className="mt-2 text-muted">
                  대화만으로 하루치를 다 채울 수는 없어요. 나머지는 사람과 닿는 쪽에서 쌓여요.
                </p>
              </section>

              {/* 별조각. 출처: 단계 미션 +1~8 lib/missions/bands.ts(rewardForStage의 band-2) ·
                  출석 4일차 5, 7일차 20 lib/missions/attendance.ts · 외출 +30~50 lib/pet.ts */}
              <section>
                <p className="mb-2 font-semibold text-ink-2">⭐ 별조각</p>
                <ul className="flex flex-col gap-1">
                  <li>단계 미션을 올라가면 +1~8</li>
                  <li>출석 4일차 +5, 7일차 +20</li>
                  <li>펫 외출에서 +30~50</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
