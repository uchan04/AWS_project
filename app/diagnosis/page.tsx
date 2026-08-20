"use client"

// 소유자: A. 진단 화면. docs/dev/diagnosis.md 10장이 확정 계약이다.
//
// 한 장으로 만든다. 문항별 라우트를 만들지 않는다.
// 다음 문항은 nextQuestion()이 정한다. 문항마다 서버를 부르지 않는다.
// 진행률을 "n/13"으로 쓰지 않는다. 조기 종료 때문에 총 문항 수가 사용자마다 다르다.
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Conversational FAQ.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  TAIL_QUESTION_CODES,
  canDecide,
  nextQuestion,
  possibleTypes,
} from "@/lib/diagnosis/adaptive"
import type { Answer } from "@/lib/diagnosis/indicators"
import "@/styles/tokens.css"
import { checkAuth, completeDiagnosis } from "./api"

/**
 * 진행률. 총 문항 수는 사람마다 달라서 쓸 수 없으므로 "좁혀진 정도"로 센다.
 * 앞 절반은 대분류 후보가 3 → 1로 줄어든 비율, 뒤 절반은 고정 꼬리 문항이 답해진 비율.
 * 답을 되돌리지 않는 한 줄어들지 않는다.
 */
function progressOf(answers: Answer[]): number {
  if (!canDecide(answers)) {
    // 후보가 3 → 2로만 줄어드는 구간이 길어서 좁혀진 정도만 쓰면 바가 멈춰 보인다.
    // 답한 개수를 4%씩 더해 매번 움직이게 하고, 45%를 넘기지 않아 다음 구간을 앞당기지 않는다
    const narrowed = ((3 - possibleTypes(answers).length) / 2) * 50
    return Math.min(45, Math.round(narrowed * 0.6 + answers.length * 4))
  }
  const tail = TAIL_QUESTION_CODES.filter((code) =>
    answers.some((answer) => answer.questionCode === code),
  ).length
  return 50 + Math.round((tail / TAIL_QUESTION_CODES.length) * 50)
}

export default function DiagnosisPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Answer[]>([])
  // 완료 API 실패 시 답변을 잃지 않는다. 같은 답변으로 다시 보낼 수 있게 화면을 유지한다
  const [error, setError] = useState<string | null>(null)
  // 문항을 그리기 전에 로그인을 확인한다. 미인증이면 완료 API가 401을 내는데,
  // 그때는 이미 문항을 다 푼 뒤라 3분을 쓰고 나서야 로그인이 필요하다는 걸 알게 된다
  const [authState, setAuthState] = useState<"checking" | "authed" | "guest">("checking")

  useEffect(() => {
    let ignore = false
    // setState는 비동기 콜백 안에서만 부른다(react-hooks/set-state-in-effect)
    checkAuth()
      .then((authed) => {
        if (!ignore) setAuthState(authed ? "authed" : "guest")
      })
      .catch(() => {
        // 확인에 실패하면 막는 쪽으로 둔다. 통과시켰다가 완료 시점에 401이 나면
        // 답변을 다 하고 나서 로그인 안내를 받게 되는데, 그게 이 게이트가 없애려는 상황이다
        if (!ignore) setAuthState("guest")
      })
    return () => {
      ignore = true
    }
  }, [])

  const question = useMemo(() => nextQuestion(answers), [answers])
  const almostDone = useMemo(() => canDecide(answers), [answers])
  const progress = useMemo(() => progressOf(answers), [answers])

  // 판정은 서버가 한다. 화면은 답변만 보낸다
  async function submit(all: Answer[]) {
    setError(null)
    try {
      await completeDiagnosis(all)
      router.push("/diagnosis/result")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "잠시 후 다시 시도해 주세요")
    }
  }

  function choose(choiceCode: string) {
    if (!question) return
    const next = [...answers, { questionCode: question.code, choiceCode }]
    setAnswers(next)
    if (nextQuestion(next)) return
    void submit(next)
  }

  if (authState === "checking") {
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-ask">
          <p className="hm__note">로그인 상태를 확인하고 있어요…</p>
        </div>
      </main>
    )
  }

  // 문항을 시작하기 전에 막는다. 답을 다 한 뒤에 401을 받는 것보다 낫다
  if (authState === "guest") {
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-ask">
          <div className="hm-card">
            <p>로그인이 필요합니다</p>
            <button type="button" onClick={() => router.push("/signup")} className="hm-btn hm-card__cta">
              회원가입하러 가기
            </button>
            <Link href="/login" className="hm-link">
              이미 계정이 있으신가요? 로그인
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // 마지막 답변 직후. 결과 화면으로 넘어가는 사이에 보인다
  if (!question) {
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-ask">
          {error ? (
            <div className="hm-card">
              <p>{error}</p>
              <button type="button" onClick={() => void submit(answers)} className="hm-btn hm-card__cta">
                다시 보내기
              </button>
            </div>
          ) : (
            <p className="hm__note">결과를 준비하고 있어요…</p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="hm hm--canvas">
      <div className="hm__col hm-ask">
        <div>
          <div className="hm-status">
            <span className="hm__note">
              {almostDone ? "거의 다 왔어요" : `${answers.length + 1}번째 질문이에요`}
            </span>
            <span className="hm__note">{progress}%</span>
          </div>
          {/* 총 문항 수는 노출하지 않는다. 값은 유형이 좁혀진 정도다 */}
          <div
            className="hm-bar"
            role="progressbar"
            aria-label="진단 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="hm-bar__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* key로 문항이 바뀔 때만 페이드한다. 같은 문항에서는 아무것도 움직이지 않는다 */}
        <div key={question.code} className="hm-fade hm-ask__body hm-card">
          <h1 className="hm-ask__question">{question.text}</h1>

          <div className="hm-ask__choices">
            {question.choices.map((choice, index) => (
              <button
                key={choice.code}
                type="button"
                onClick={() => choose(choice.code)}
                className="hm-row"
              >
                <span>
                  <span className="hm-row__key" aria-hidden="true">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {choice.label}
                </span>
                <span className="hm-row__mark" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>

        {answers.length > 0 && (
          <button
            type="button"
            onClick={() => setAnswers(answers.slice(0, -1))}
            className="hm-link"
          >
            이전 질문으로
          </button>
        )}
      </div>
    </main>
  )
}
