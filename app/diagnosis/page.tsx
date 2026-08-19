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
import { canDecide, nextQuestion } from "@/lib/diagnosis/adaptive"
import type { Answer } from "@/lib/diagnosis/indicators"
import "@/styles/tokens.css"
import { saveDraft } from "./draft"

export default function DiagnosisPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Answer[]>([])

  const question = useMemo(() => nextQuestion(answers), [answers])
  const almostDone = useMemo(() => canDecide(answers), [answers])

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
      <main className="hm">
        <div className="hm__col">
          <p className="hm__note">결과를 준비하고 있어요…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="hm">
      <div className="hm__col hm-ask">
        <div className="hm-status">
          {/* 답한 개수만 점으로 보여준다. 총 개수는 사람마다 달라서 쓸 수 없다 */}
          <span className="hm-status__dots" aria-hidden="true">
            {answers.map((answer) => (
              <span key={answer.questionCode} className="hm-status__dot" />
            ))}
            <span className="hm-status__dot hm-status__dot--now" />
          </span>
          <span className="hm__note">
            {almostDone ? "거의 다 왔어요" : `${answers.length + 1}번째 질문이에요`}
          </span>
        </div>

        {/* key로 문항이 바뀔 때만 페이드한다. 같은 문항에서는 아무것도 움직이지 않는다 */}
        <div key={question.code} className="hm-fade hm-ask__body">
          <h1 className="hm-ask__question">{question.text}</h1>

          <div className="hm-ask__choices">
            {question.choices.map((choice) => (
              <button
                key={choice.code}
                type="button"
                onClick={() => choose(choice.code)}
                className="hm-row"
              >
                <span>{choice.label}</span>
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
