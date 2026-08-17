import type { Adjective, TypeCode } from "@prisma/client"
import { ADJECTIVE_BY_CHOICE } from "../types"
import { CHOICE_INDEX, QUESTIONS, type Axis } from "./questions"

// 소유자: A. 유형 판정 (docs/dev/diagnosis.md 5장).
// 판정은 100% 코드다. LLM을 호출하지 않는다. 순수 함수라 DB도 필요 없다.
// 기대값은 scripts/check-diagnosis.ts에 고정돼 있다. npm run check:diagnosis

export type AxisScores = Record<Axis, number>

/** 클라이언트가 보내는 답변. 코드만 받는다. */
export type Answer = { questionCode: string; choiceCode: string }

/** 서버가 축·가중치를 채운 형태. DiagnosisSession.answers에 이대로 저장한다. */
export type ResolvedAnswer = {
  questionCode: string
  choiceCode: string
  axis: Axis | null
  weight: number
}

export type DiagnosisResult = {
  typeCode: TypeCode
  adjective: Adjective
  axisScores: AxisScores
}

/**
 * 답변을 검증하고 축·가중치를 서버 문항 테이블에서 채운다.
 * 클라이언트가 보낸 weight는 쓰지 않는다. 조작하면 원하는 유형을 만들 수 있다.
 * 문항 순서(Q1~Q6)로 정렬해 돌려준다.
 */
export function resolveAnswers(answers: Answer[]): ResolvedAnswer[] {
  const byQuestion = new Map<string, ResolvedAnswer>()

  for (const answer of answers) {
    const found = CHOICE_INDEX[answer.choiceCode]
    if (!found) {
      throw new Error(`INVALID_ANSWER: 알 수 없는 선택지 ${answer.choiceCode}`)
    }
    // 선택지가 실제로 속한 문항을 기준으로 본다. 클라이언트가 보낸 questionCode는 대조용이다.
    if (answer.questionCode !== found.question.code) {
      throw new Error(
        `INVALID_ANSWER: ${answer.choiceCode}는 ${found.question.code}의 선택지다`,
      )
    }
    if (byQuestion.has(found.question.code)) {
      throw new Error(`INVALID_ANSWER: ${found.question.code}가 두 번 들어왔다`)
    }
    byQuestion.set(found.question.code, {
      questionCode: found.question.code,
      choiceCode: found.choice.code,
      axis: found.question.axis,
      weight: found.choice.weight,
    })
  }

  return QUESTIONS.map((question) => {
    const resolved = byQuestion.get(question.code)
    if (!resolved) {
      throw new Error(`INVALID_ANSWER: ${question.code} 답변이 없다`)
    }
    return resolved
  })
}

export function classify(answers: Answer[]): DiagnosisResult {
  const resolved = resolveAnswers(answers)
  const choiceOf = (questionCode: string) =>
    resolved.find((answer) => answer.questionCode === questionCode)!

  const weightOf = (questionCode: string) => choiceOf(questionCode).weight

  const axisScores: AxisScores = {
    housing: weightOf("Q1"),
    health: weightOf("Q2") + weightOf("Q3"),
    employment: weightOf("Q4") + weightOf("Q5"),
  }

  // 규칙은 위에서부터 순서대로, 처음 걸리는 곳에서 멈춘다.
  //   1. 가족 동거는 다른 축을 보지 않고 확정한다
  //   2. 동점이면 HEALTH_EMOTION (미션 강도가 더 낮아 잘못 판정했을 때 피해가 적다)
  //   3. 그 외 — 전부 0인 경우의 기본값도 여기다 (1인 가구가 이 유형의 핵심 특성)
  const typeCode: TypeCode =
    choiceOf("Q1").choiceCode === "Q1_FAMILY"
      ? "FAMILY_LIVING"
      : axisScores.health >= 2 && axisScores.health >= axisScores.employment
        ? "HEALTH_EMOTION"
        : "INDEPENDENT_LOW_INCOME"

  return {
    typeCode,
    adjective: ADJECTIVE_BY_CHOICE[choiceOf("Q6").choiceCode],
    axisScores,
  }
}
