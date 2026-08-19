"use client"

// 소유자: A. 진단 화면. docs/dev/diagnosis.md 10장이 확정 계약이다.
//
// 한 장으로 만든다. 문항별 라우트를 만들지 않는다.
// 다음 문항은 nextQuestion()이 정한다. 문항마다 서버를 부르지 않는다.
// 진행률을 "n/13"으로 쓰지 않는다. 조기 종료 때문에 총 문항 수가 사용자마다 다르다.

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { canDecide, nextQuestion } from "@/lib/diagnosis/adaptive"
import type { Answer } from "@/lib/diagnosis/indicators"
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
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <p className="text-sm text-neutral-500">결과를 준비하고 있어요…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <p className="text-sm text-neutral-500">
        {almostDone ? "거의 다 왔어요" : `${answers.length + 1}번째 질문이에요`}
      </p>

      <h1 className="text-xl font-bold leading-relaxed">{question.text}</h1>

      <div className="flex flex-col gap-3">
        {question.choices.map((choice) => (
          <button
            key={choice.code}
            type="button"
            onClick={() => choose(choice.code)}
            className="rounded-xl border border-neutral-300 px-4 py-4 text-left text-base hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {choice.label}
          </button>
        ))}
      </div>

      {answers.length > 0 && (
        <button
          type="button"
          onClick={() => setAnswers(answers.slice(0, -1))}
          className="self-start text-sm text-neutral-500 underline"
        >
          이전 질문으로
        </button>
      )}
    </main>
  )
}
