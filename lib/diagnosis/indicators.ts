// 답변 → 지표 14개. docs/dev/diagnosis.md 4장이 확정 스펙이다.
//
// 대분류(classify)와 세부유형(classifySub)이 전부 이 결과만 본다.
// 규칙을 고칠 때 한 곳만 고치기 위해 이 단계를 끼웠다.

import {
  ADJECTIVE_QUESTION_CODE,
  CHOICE_INDEX,
  ECON_INDICATORS,
  HEALTH_INDICATORS,
  INDICATORS,
  type Indicator,
} from "./questions"

/** 클라이언트가 보내는 답변. 코드만 받는다 */
export type Answer = { questionCode: string; choiceCode: string }

export type Indicators = Record<Indicator, boolean>

export type Resolved = {
  indicators: Indicators
  /** 답변한 문항 코드 */
  answered: string[]
  /** 형용사 문항의 choiceCode. 없으면 null */
  adjectiveChoice: string | null
  health: number
  econ: number
  /** Q3·Q4 PHQ 점수 합. 조기 종료 계산이 쓴다 */
  phq: number
}

export const EMPTY_INDICATORS: Indicators = Object.fromEntries(
  INDICATORS.map((name) => [name, false]),
) as Indicators

function fail(reason: string): never {
  throw new Error(`INVALID_ANSWER: ${reason}`)
}

/**
 * 답변을 지표로 바꾼다. 조기 종료 때문에 지표 문항은 일부만 와도 된다.
 * 답하지 않은 문항의 지표는 false다.
 */
export function resolveIndicators(answers: Answer[]): Resolved {
  const indicators: Indicators = { ...EMPTY_INDICATORS }
  const answered: string[] = []
  let phq = 0
  let adjectiveChoice: string | null = null

  for (const answer of answers) {
    const found = CHOICE_INDEX[answer.choiceCode]
    if (!found) fail(`알 수 없는 선택지 ${answer.choiceCode}`)

    // 클라이언트가 보낸 questionCode는 검증에만 쓴다. 지표는 서버 표의 문항에서 가져온다
    if (found.question.code !== answer.questionCode) {
      fail(`문항과 선택지가 어긋남 ${answer.questionCode} / ${answer.choiceCode}`)
    }
    if (answered.includes(found.question.code)) fail(`문항 중복 ${found.question.code}`)

    answered.push(found.question.code)

    if (found.question.code === ADJECTIVE_QUESTION_CODE) {
      adjectiveChoice = found.choice.code
      continue
    }

    for (const flag of found.choice.flags ?? []) indicators[flag] = true
    phq += found.choice.phq ?? 0
  }

  // PHQ-2 표준 컷오프. Q3·Q4 합이 3점 이상이면 우울
  indicators.DEPRESSED = phq >= 3

  return {
    indicators,
    answered,
    adjectiveChoice,
    health: countOf(indicators, HEALTH_INDICATORS),
    econ: countOf(indicators, ECON_INDICATORS),
    phq,
  }
}

export function countOf(indicators: Indicators, names: Indicator[]): number {
  return names.filter((name) => indicators[name]).length
}
