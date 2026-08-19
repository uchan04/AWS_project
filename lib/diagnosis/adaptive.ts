// 무손실 조기 종료. docs/dev/diagnosis.md 8장이 확정 스펙이다.
//
// 대분류 판정에 들어가는 것은 (ALONE, health, econ) 세 값뿐이고, 각 문항이 이 값에
// 더하는 양이 정해져 있다. 그래서 미답 문항이 만들 수 있는 상태를 전부 열거해도
// 250개를 넘지 않는다. 근사·휴리스틱이 아니라 가능한 유형 집합을 정확히 계산한다.
//
// 남은 문항을 어떻게 채워도 같은 유형이 나올 때만 확정하므로 정확도 손실이 0이다.

import type { TypeCode } from "@prisma/client"
import { classifyType } from "./classify"
import { type Answer, resolveIndicators } from "./indicators"
import {
  ADJECTIVE_QUESTION_CODE,
  type Choice,
  INDICATOR_QUESTIONS,
  type Question,
  QUESTIONS,
} from "./questions"

/**
 * 조기 종료 후에도 반드시 묻는 문항.
 *
 * Q11·Q12는 대분류에 전혀 영향을 주지 않지만 세부유형 8개 중 3개(자립준비·가족돌봄·
 * 지역이주)가 여기에만 달려 있다. 건너뛰면 관리자 통계에서 그 3개가 사라진다.
 * Q13은 형용사 전용이라 없으면 닉네임을 못 만든다.
 */
export const TAIL_QUESTION_CODES = ["Q11", "Q12", ADJECTIVE_QUESTION_CODE]

/** 대분류를 가르는 문항. 조기 종료 계산 대상 */
const DECIDING_QUESTIONS = INDICATOR_QUESTIONS.filter((q) => !TAIL_QUESTION_CODES.includes(q.code))

type State = {
  /** null이면 Q1을 아직 안 물어서 모른다 */
  alone: boolean | null
  /** health 중 DEPRESSED를 뺀 나머지 개수 */
  healthFlags: number
  phq: number
  econ: number
}

const HEALTH_FLAG_NAMES = ["MENTAL_UNMET", "PHYSICAL_UNMET", "ACTIVITY_LIMIT", "BURNOUT"]
const ECON_FLAG_NAMES = ["HOUSING_UNSTABLE", "LOW_INCOME", "DEBT", "JOBLESS"]

function deltaOf(question: Question, choice: Choice) {
  const flags = choice.flags ?? []
  return {
    alone: question.code === "Q1" ? flags.includes("ALONE") : null,
    healthFlags: flags.filter((f) => HEALTH_FLAG_NAMES.includes(f)).length,
    econ: flags.filter((f) => ECON_FLAG_NAMES.includes(f)).length,
    phq: choice.phq ?? 0,
  }
}

function healthOf(state: State): number {
  return state.healthFlags + (state.phq >= 3 ? 1 : 0)
}

function keyOf(state: State): string {
  return `${state.alone}|${state.healthFlags}|${state.phq}|${state.econ}`
}

/** 이 답변들로 아직 가능한 대분류. 항상 1~3개 */
export function possibleTypes(answers: Answer[]): TypeCode[] {
  const { indicators, answered, health, econ, phq } = resolveIndicators(answers)

  const base: State = {
    alone: answered.includes("Q1") ? indicators.ALONE : null,
    healthFlags: health - (indicators.DEPRESSED ? 1 : 0),
    phq,
    econ,
  }

  let states = new Map<string, State>([[keyOf(base), base]])

  for (const question of DECIDING_QUESTIONS) {
    if (answered.includes(question.code)) continue

    const next = new Map<string, State>()
    for (const state of states.values()) {
      for (const choice of question.choices) {
        const delta = deltaOf(question, choice)
        const moved: State = {
          alone: delta.alone === null ? state.alone : delta.alone,
          healthFlags: state.healthFlags + delta.healthFlags,
          phq: state.phq + delta.phq,
          econ: state.econ + delta.econ,
        }
        next.set(keyOf(moved), moved)
      }
    }
    states = next
  }

  const types = new Set<TypeCode>()
  for (const state of states.values()) {
    // Q1 미답이면 두 경우 모두 가능하다
    const alones = state.alone === null ? [true, false] : [state.alone]
    for (const alone of alones) types.add(classifyType(alone, healthOf(state), state.econ))
  }
  return [...types]
}

/** 남은 문항을 어떻게 채워도 대분류가 바뀌지 않는가 */
export function canDecide(answers: Answer[]): boolean {
  return possibleTypes(answers).length === 1
}

/**
 * 다음에 물을 문항. 없으면 null(= 완료 API를 호출할 시점).
 *
 * 대분류가 갈리는 동안은 "최악의 경우 남는 유형 수가 가장 적은" 문항을 고른다.
 * 동점이면 문항 번호 순이라 결정적이다.
 */
export function nextQuestion(answers: Answer[]): Question | null {
  const { answered } = resolveIndicators(answers)

  if (!canDecide(answers)) {
    let best: { question: Question; worst: number } | null = null

    for (const question of DECIDING_QUESTIONS) {
      if (answered.includes(question.code)) continue

      const worst = Math.max(
        ...question.choices.map(
          (choice) =>
            possibleTypes([...answers, { questionCode: question.code, choiceCode: choice.code }]).length,
        ),
      )
      if (!best || worst < best.worst) best = { question, worst }
    }
    if (best) return best.question
  }

  for (const code of TAIL_QUESTION_CODES) {
    if (!answered.includes(code)) return QUESTIONS.find((q) => q.code === code) ?? null
  }
  return null
}
