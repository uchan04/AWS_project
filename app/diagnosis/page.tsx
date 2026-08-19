"use client"

// 소유자: A. 진단 화면. docs/dev/diagnosis.md 10장이 확정 계약이다.
//
// 한 장으로 만든다. 문항별 라우트를 만들지 않는다.
// 다음 문항은 nextQuestion()이 정한다. 문항마다 서버를 부르지 않는다.
// 진행률을 "n/13"으로 쓰지 않는다. 조기 종료 때문에 총 문항 수가 사용자마다 다르다.
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Conversational FAQ.

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  TAIL_QUESTION_CODES,
  canDecide,
  nextQuestion,
  possibleTypes,
} from "@/lib/diagnosis/adaptive"
import type { Answer } from "@/lib/diagnosis/indicators"
import "@/styles/tokens.css"
import { saveDraft } from "./draft"

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

  const question = useMemo(() => nextQuestion(answers), [answers])
  const almostDone = useMemo(() => canDecide(answers), [answers])
  const progress = useMemo(() => progressOf(answers), [answers])

  function choose(choiceCode: string) {
    if (!question) return
    const next = [...answers, { questionCode: question.code, choiceCode }]
    setAnswers(next)
    if (nextQuestion(next)) return

    // 완료 API(POST /api/diagnosis/complete)는 DATABASE_URL 공유 후에 붙인다.
    // 그때까지는 답변을 결과 화면으로 넘기고 판정을 화면에서 한다.
    saveDraft(next)
    router.push("/diagnosis/result")
  }

  // 마지막 답변 직후. 결과 화면으로 넘어가는 사이에만 보인다
  if (!question) {
    return (
      <main className="hm hm--canvas">
        <div className="hm__col">
          <p className="hm__note">결과를 준비하고 있어요…</p>
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
