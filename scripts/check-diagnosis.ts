import assert from "node:assert/strict"
import type { SubTypeCode, TypeCode } from "@prisma/client"
import { canDecide, nextQuestion, possibleTypes } from "../lib/diagnosis/adaptive"
import { classify } from "../lib/diagnosis/classify"
import type { Answer } from "../lib/diagnosis/indicators"
import { INDICATOR_QUESTIONS } from "../lib/diagnosis/questions"
import { REASON_LINES, validateReasonLines } from "../lib/diagnosis/reason"

// npm run check:diagnosis
//
// docs/dev/diagnosis.md 9장의 시나리오다. 기대값은 손으로 확정한 것이다.
// 어긋나면 판정 규칙이나 지표 매핑이 틀린 것이다. 기대값을 구현 결과에 맞춰 고치지 않는다.

/** 지표를 하나도 켜지 않는 답. 시나리오가 지정하지 않은 문항은 이 값으로 채운다 */
const NO_SIGNAL: Record<string, string> = {
  Q1: "FAMILY",
  Q2: "SAFE",
  Q3: "SAME",
  Q4: "OK",
  Q5: "FULL",
  Q6: "NONE",
  Q7: "NONE",
  Q8: "ROOM",
  Q9: "NONE",
  Q10: "FIXED",
  Q11: "STAY",
  Q12: "NONE",
}

type Scenario = {
  id: string
  /** 문항 코드 → 선택지 접미사. 나머지는 무신호로 채운다 */
  pick: Record<string, string>
  health: number
  econ: number
  typeCode: TypeCode
  subTypeCode: SubTypeCode
  note: string
}

const SCENARIOS: Scenario[] = [
  // 사실 유형(자립준비·가족돌봄·지역이주)이 다른 취약성보다 앞이다
  {
    id: "A1",
    pick: { Q1: "FAMILY", Q11: "AFTERCARE" },
    health: 0,
    econ: 0,
    typeCode: "FAMILY_LIVING",
    subTypeCode: "AFTERCARE_YOUTH",
    note: "사실 유형이 최우선",
  },
  {
    id: "A2",
    pick: { Q1: "ALONE", Q11: "AFTERCARE", Q8: "FEAR", Q9: "HEAVY" },
    health: 0,
    econ: 2,
    typeCode: "INDEPENDENT_LOW_INCOME",
    subTypeCode: "AFTERCARE_YOUTH",
    note: "자립준비가 채무보다 앞",
  },
  {
    id: "C1",
    pick: { Q1: "FAMILY", Q12: "MAIN" },
    health: 0,
    econ: 0,
    typeCode: "FAMILY_LIVING",
    subTypeCode: "FAMILY_CAREGIVER",
    note: "돌봄",
  },
  {
    id: "C2",
    pick: { Q1: "FAMILY", Q12: "MAIN", Q3: "NONE", Q4: "HEAVY", Q5: "EMPTY", Q6: "BOTH" },
    health: 4,
    econ: 0,
    typeCode: "HEALTH_EMOTION",
    subTypeCode: "FAMILY_CAREGIVER",
    note: "대분류와 세부유형은 서로를 참조하지 않는다",
  },
  {
    id: "M1",
    pick: { Q1: "ALONE", Q11: "MIGRANT", Q8: "JUST" },
    health: 0,
    econ: 1,
    typeCode: "INDEPENDENT_LOW_INCOME",
    subTypeCode: "MIGRANT_YOUTH",
    note: "이주",
  },

  // 건강·정서
  {
    id: "H1",
    pick: { Q1: "ALONE", Q3: "NONE", Q4: "HEAVY", Q6: "BOTH", Q5: "EMPTY", Q7: "OFTEN" },
    health: 5,
    econ: 0,
    typeCode: "HEALTH_EMOTION",
    subTypeCode: "HEALTH_FRAGILE",
    note: "건강 최대",
  },
  {
    id: "H2",
    pick: { Q1: "FAMILY", Q3: "NONE", Q4: "HEAVY", Q5: "EMPTY", Q7: "SOME" },
    health: 2,
    econ: 0,
    typeCode: "FAMILY_LIVING",
    subTypeCode: "FAMILY_DEPENDENT",
    note: "health 2는 규칙 1 미달. 가족이 이긴다",
  },
  {
    id: "H3",
    pick: { Q1: "FAMILY", Q3: "NONE", Q4: "HEAVY", Q5: "EMPTY", Q7: "OFTEN" },
    health: 3,
    econ: 0,
    typeCode: "HEALTH_EMOTION",
    subTypeCode: "HEALTH_FRAGILE",
    note: "health 3에서 가족을 이긴다",
  },
  {
    id: "H4",
    pick: { Q1: "ALONE", Q3: "LESS", Q4: "DRAG", Q5: "HALF", Q8: "FEAR", Q9: "HEAVY", Q10: "EMPTY" },
    health: 1,
    econ: 3,
    typeCode: "INDEPENDENT_LOW_INCOME",
    subTypeCode: "DEBT_INDEPENDENT",
    note: "PHQ 2점은 우울 미달",
  },
  {
    id: "H5",
    pick: { Q1: "ALONE", Q3: "NONE", Q4: "DRAG", Q5: "HALF" },
    health: 2,
    econ: 0,
    typeCode: "HEALTH_EMOTION",
    subTypeCode: "FAMILY_DEPENDENT",
    note: "PHQ 3점에서 우울이 켜진다",
  },
  {
    id: "H6",
    pick: { Q1: "ALONE", Q3: "NONE", Q4: "HEAVY", Q6: "MENTAL", Q8: "FEAR", Q9: "HEAVY" },
    health: 2,
    econ: 2,
    typeCode: "HEALTH_EMOTION",
    subTypeCode: "DEBT_INDEPENDENT",
    note: "동점은 HEALTH",
  },

  // 독립거주·저소득
  {
    id: "I1",
    pick: {
      Q1: "ALONE",
      Q3: "NONE",
      Q4: "HEAVY",
      Q6: "MENTAL",
      Q8: "FEAR",
      Q9: "HEAVY",
      Q10: "EMPTY",
    },
    health: 2,
    econ: 3,
    typeCode: "INDEPENDENT_LOW_INCOME",
    subTypeCode: "DEBT_INDEPENDENT",
    note: "econ이 1 크면 뒤집힌다",
  },
  {
    id: "I2",
    pick: { Q1: "ALONE", Q8: "FEAR", Q9: "HEAVY", Q2: "RISK", Q10: "EMPTY" },
    health: 0,
    econ: 4,
    typeCode: "INDEPENDENT_LOW_INCOME",
    subTypeCode: "DEBT_INDEPENDENT",
    note: "경제 최대",
  },
  {
    id: "I3",
    pick: { Q1: "ALONE" },
    health: 0,
    econ: 0,
    typeCode: "INDEPENDENT_LOW_INCOME",
    subTypeCode: "FAMILY_DEPENDENT",
    note: "전부 0 + 혼자 → 고양이",
  },

  // 가족동거
  {
    id: "F1",
    pick: { Q1: "FAMILY" },
    health: 0,
    econ: 0,
    typeCode: "FAMILY_LIVING",
    subTypeCode: "FAMILY_DEPENDENT",
    note: "전부 0 + 가족 → 곰",
  },
  {
    id: "F2",
    pick: { Q1: "FAMILY", Q8: "FEAR", Q9: "HEAVY" },
    health: 0,
    econ: 2,
    typeCode: "FAMILY_LIVING",
    subTypeCode: "FINANCIAL_FRAGILE",
    note: "동거 + 빚 → 금융취약",
  },
  {
    id: "F3",
    pick: { Q1: "FAMILY", Q8: "FEAR", Q10: "EMPTY" },
    health: 0,
    econ: 2,
    typeCode: "FAMILY_LIVING",
    subTypeCode: "JOBLESS_POOR",
    note: "빚 없이 미취업 + 저소득",
  },
  {
    id: "F4",
    pick: { Q1: "FAMILY", Q10: "EMPTY" },
    health: 0,
    econ: 1,
    typeCode: "FAMILY_LIVING",
    subTypeCode: "FAMILY_DEPENDENT",
    note: "미취업만이면 기본값",
  },
  {
    id: "J1",
    pick: { Q1: "ALONE", Q10: "EMPTY", Q8: "FEAR" },
    health: 0,
    econ: 2,
    typeCode: "INDEPENDENT_LOW_INCOME",
    subTypeCode: "JOBLESS_POOR",
    note: "혼자 + 미취업빈곤",
  },
  {
    id: "B1",
    pick: { Q1: "SHARE", Q7: "SOME", Q5: "MOST", Q3: "MIXED", Q4: "FLAT", Q12: "HELP" },
    health: 0,
    econ: 0,
    typeCode: "INDEPENDENT_LOW_INCOME",
    subTypeCode: "FAMILY_DEPENDENT",
    note: "중간 답변은 지표를 켜지 않는다. 비가족 동거는 1인 가구 계열",
  },
]

const ADJECTIVE_ANSWER: Answer = { questionCode: "Q13", choiceCode: "Q13_NIGHT_ALONE" }

/** 시나리오를 12문항 전부 답한 형태로 펼친다 */
function fullAnswers(scenario: Scenario): Answer[] {
  const answers = INDICATOR_QUESTIONS.map((question) => ({
    questionCode: question.code,
    choiceCode: `${question.code}_${scenario.pick[question.code] ?? NO_SIGNAL[question.code]}`,
  }))
  return [...answers, ADJECTIVE_ANSWER]
}

/** 시나리오 답변 중 특정 문항의 답 */
function answerFor(scenario: Scenario, questionCode: string): Answer {
  if (questionCode === "Q13") return ADJECTIVE_ANSWER
  return {
    questionCode,
    choiceCode: `${questionCode}_${scenario.pick[questionCode] ?? NO_SIGNAL[questionCode]}`,
  }
}

// 1. 전체 문항 판정
for (const scenario of SCENARIOS) {
  const result = classify(fullAnswers(scenario))
  const where = `${scenario.id} (${scenario.note})`

  assert.equal(result.health, scenario.health, `${where} health 점수`)
  assert.equal(result.econ, scenario.econ, `${where} econ 점수`)
  assert.equal(result.typeCode, scenario.typeCode, `${where} 대분류`)
  assert.equal(result.subTypeCode, scenario.subTypeCode, `${where} 세부유형`)
}

// 2. 경계쌍. 규칙의 임계값이 정확히 어디서 뒤집히는지 고정한다
const byId = (id: string) => SCENARIOS.find((s) => s.id === id)!
const typeOf = (id: string) => classify(fullAnswers(byId(id))).typeCode

assert.notEqual(typeOf("H2"), typeOf("H3"), "H2/H3 — health 3이 가족 동거를 이기는 지점")
assert.notEqual(typeOf("H4"), typeOf("H5"), "H4/H5 — PHQ 3점이 우울을 켜는 지점")
assert.notEqual(typeOf("H6"), typeOf("I1"), "H6/I1 — econ이 health를 넘는 지점")

// 3. 조기 종료가 무손실인지. 답변을 하나도 안 했으면 세 유형 전부 가능하다
assert.equal(possibleTypes([]).length, 3, "답변 0개면 후보 3개")
assert.equal(canDecide([]), false, "답변 0개로는 확정할 수 없다")

let maxAsked = 0
let totalAsked = 0

for (const scenario of SCENARIOS) {
  const expected = classify(fullAnswers(scenario)).typeCode
  const where = `${scenario.id} (${scenario.note})`

  // 실제 화면 흐름을 그대로 돌린다. nextQuestion이 정한 순서로만 답한다
  const asked: Answer[] = []
  let previous = 3
  for (;;) {
    const question = nextQuestion(asked)
    if (!question) break
    asked.push(answerFor(scenario, question.code))

    const candidates = possibleTypes(asked).length
    assert.ok(candidates <= previous, `${where} 후보 수가 늘어났다 (${previous} → ${candidates})`)
    previous = candidates

    assert.ok(asked.length <= 13, `${where} 문항이 13개를 넘었다`)
  }

  // 무손실: 조기 종료로 얻은 유형이 12문항 전체 판정과 같다
  assert.equal(classify(asked).typeCode, expected, `${where} 조기 종료 결과가 전체 판정과 다르다`)
  assert.equal(canDecide(asked), true, `${where} 종료 시점에 확정되지 않았다`)

  maxAsked = Math.max(maxAsked, asked.length)
  totalAsked += asked.length
}

// 4. 이상 입력은 모두 throw한다. API는 INVALID_ANSWER로 응답한다
const FULL = fullAnswers(byId("H1"))

assert.throws(
  () => classify([{ questionCode: "Q2", choiceCode: "Q2_UNKNOWN" }, ...FULL]),
  /INVALID_ANSWER/,
  "없는 선택지",
)
assert.throws(
  () => classify([...FULL, { questionCode: "Q3", choiceCode: "Q3_SAME" }]),
  /INVALID_ANSWER/,
  "문항 중복",
)
assert.throws(
  () => classify([{ questionCode: "Q1", choiceCode: "Q4_HEAVY" }, ...FULL.slice(1)]),
  /INVALID_ANSWER/,
  "문항과 선택지 불일치",
)
assert.throws(
  () => classify(FULL.filter((a) => a.questionCode !== "Q13")),
  /INVALID_ANSWER/,
  "형용사 문항 누락",
)

// 지표 문항은 일부만 와도 된다. 조기 종료가 그렇게 동작한다
assert.equal(
  classify([{ questionCode: "Q1", choiceCode: "Q1_FAMILY" }, ADJECTIVE_ANSWER]).typeCode,
  "FAMILY_LIVING",
  "Q1 + 형용사만으로도 판정된다",
)

// 근거 3줄(SPEC 3절)의 출력 검사. Bedrock 없이 도는 부분만 여기서 고정한다.
// 낙인 단어 차단이 이 기능의 유일한 안전장치이므로 모델의 선의에 맡기지 않는다
const GOOD = [
  "고지서 날짜가 마음에 걸린다고 하셨죠. 작은 일부터 함께 챙겨볼게요.",
  "혼자 지내고 있다고 하셨어요. 같은 종족과 익명으로 이야기할 수 있어요.",
  "아침이 무겁다고 하셨죠. 오늘은 커튼 하나 여는 것부터 해볼까요.",
]
assert.equal(validateReasonLines(GOOD).length, REASON_LINES, "정상 3줄은 통과한다")
assert.throws(() => validateReasonLines(GOOD.slice(0, 2)), /줄 수/, "2줄은 막는다")
assert.throws(() => validateReasonLines([...GOOD.slice(0, 2), "  "]), /길이/, "빈 줄은 막는다")
assert.throws(
  () => validateReasonLines([...GOOD.slice(0, 2), "저소득 상황이시군요. 함께 해볼게요."]),
  /쓸 수 없는 단어/,
  "낙인 단어는 막는다",
)
assert.throws(
  () => validateReasonLines([...GOOD.slice(0, 2), "당신은 건강·정서취약형 유형입니다."]),
  /쓸 수 없는 단어/,
  "유형명은 막는다",
)

const average = (totalAsked / SCENARIOS.length).toFixed(1)
console.log(
  `diagnosis 체크 통과 (시나리오 ${SCENARIOS.length}개, 경계쌍 3, 이상 입력 4, 근거 검사 5) — 실제 문항 수 평균 ${average}개, 최대 ${maxAsked}개`,
)
