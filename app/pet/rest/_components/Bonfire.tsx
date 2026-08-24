"use client"

import { useEffect, useRef, useState } from "react"
import { CRISIS_BURN_NOTICE, isCrisis } from "@/lib/safety"
import { withSubject } from "@/lib/types"
import { CrisisNotice } from "@/app/components/CrisisNotice"

// 소유자: C. "고민 태우기". 원안(develop의 BonfireModal)에서 바꾼 것:
//
// - **위기 신호를 그냥 태우지 않는다.** 원안은 무엇을 적어도 2초 뒤 모달을 닫았다.
//   "죽고 싶다"를 적을 수 있는 칸을 만들어 놓고 아무 일도 일어나지 않게 두는 것은
//   기능이 아니라 위험이다. lib/safety.ts의 isCrisis()를 태우기 직전에 통과시킨다.
//   막지는 않는다 — 태우는 것 자체가 이 화면의 값이고, 검열되면 다시 안 쓴다.
// - 모달이 아니라 화면 안의 카드다. 원안은 zIndex 500 전체 화면 모달이었는데,
//   이미 /pet/rest 자체가 조용한 전용 화면이라 그 위에 또 덮을 이유가 없다.
// - 색을 하드코딩(#1E1A17 …)하지 않고 pet.css의 종족 토큰을 쓴다.

/** 불꽃 연출 길이. 이보다 짧으면 "태웠다"는 느낌이 안 나고, 길면 기다림이 된다 */
const BURN_MS = 1800

type Phase = "write" | "burning" | "done"

export default function Bonfire({ animal }: { animal: string | null }) {
  const [text, setText] = useState("")
  const [phase, setPhase] = useState<Phase>("write")
  // 태운 글에 위기 신호가 있었는지. **원문은 남기지 않는다** — 판정 결과만 들고 있는다
  const [crisis, setCrisis] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function burn() {
    const trimmed = text.trim()
    if (!trimmed || phase !== "write") return

    // 판정은 여기서 끝난다. 서버로 보내지 않는다
    setCrisis(isCrisis(trimmed))
    // 상태를 먼저 비운다. 연출이 끝난 뒤에 지우면 그 1.8초 동안 원문이 DOM에 남는다
    setText("")
    setPhase("burning")
    timerRef.current = setTimeout(() => setPhase("done"), BURN_MS)
  }

  function again() {
    setCrisis(false)
    setPhase("write")
  }

  return (
    <section className="pet-card pet-burn">
      <div className="pet-card__head">
        <h2 className="pet-card__title">🔥 고민 태우기</h2>
        <span className="pet-card__meta">저장하지 않아요</span>
      </div>

      {phase === "write" ? (
        <>
          <p className="pet-card__foot pet-burn__lede">
            <span>
              적은 글은 <strong>어디에도 저장되지 않고</strong> 화면에서 사라져요. 서버로도
              보내지 않아요.
            </span>
          </p>
          <label className="pet-burn__label" htmlFor="bonfire-text">
            지금 마음에 걸리는 것
          </label>
          <textarea
            id="bonfire-text"
            className="pet-burn__input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="맞춤법도, 순서도 상관없어요. 떠오르는 대로 적어요"
          />
          <button
            type="button"
            className="pet-btn pet-btn--block"
            onClick={burn}
            disabled={!text.trim()}
            aria-disabled={!text.trim()}
          >
            불에 넣기 🔥
          </button>
        </>
      ) : null}

      {phase === "burning" ? (
        <div className="pet-burn__fire" role="status">
          {/* 불꽃 3개. 각자 다른 지연으로 흔들린다(pet.css .pet-burn__flame) */}
          <span className="pet-burn__flame" data-i="1" aria-hidden="true">
            🔥
          </span>
          <span className="pet-burn__flame" data-i="2" aria-hidden="true">
            🔥
          </span>
          <span className="pet-burn__flame" data-i="3" aria-hidden="true">
            🔥
          </span>
          <p className="pet-burn__status">태우고 있어요…</p>
        </div>
      ) : null}

      {phase === "done" ? (
        <div className="pet-burn__done">
          {/* 위기 신호가 있었으면 번호를 남긴다. 없으면 평범한 마무리 한 줄이다.
              CrisisNotice는 챗봇·글쓰기·댓글과 같은 카드다(app/components/CrisisNotice.tsx) */}
          {crisis ? (
            <CrisisNotice message={CRISIS_BURN_NOTICE} />
          ) : (
            <p className="pet-burn__status">
              다 탔어요. 아무 데도 남지 않았어요.
              {animal ? ` ${withSubject(animal)} 옆에서 지켜봤어요.` : ""}
            </p>
          )}
          <button type="button" className="pet-plank pet-burn__again" onClick={again}>
            하나 더 태우기
          </button>
        </div>
      ) : null}
    </section>
  )
}
