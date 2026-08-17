import assert from "node:assert/strict"
import type { Adjective, TypeCode } from "@prisma/client"
import { classify, type Answer } from "../lib/diagnosis/classify"

// npm run check:diagnosis
//
// docs/dev/diagnosis.md 6장의 시나리오 18개다. 기대값은 손으로 확정한 것이다.
// 어긋나면 판정 함수나 문항 weight가 틀린 것이다. 기대값을 구현 결과에 맞춰 고치지 않는다.

type Row = [
  id: string,
  q1: string,
  q2: string,
  q3: string,
  q4: string,
  q5: string,
  q6: string,
  health: number,
  employment: number,
  typeCode: TypeCode,
  adjective: Adjective,
]

const ROWS: Row[] = [
  // 가족 동거 — 다른 축을 보지 않고 확정한다
  ["F1", "FAMILY", "HEAVY", "EXHAUSTED", "NONE", "DEBT", "NIGHT_ALONE", 4, 4, "FAMILY_LIVING", "QUIET"],
  ["F2", "FAMILY", "OK", "FINE", "WORKING", "OK", "ON_PLAN", 0, 0, "FAMILY_LIVING", "DILIGENT"],
  ["F3", "FAMILY", "UPDOWN", "SOMETIMES", "SEEKING", "TIGHT", "WITH_CLOSE", 2, 2, "FAMILY_LIVING", "WARM"],
  ["F4", "FAMILY", "FLAT", "NEED_CARE", "PART", "UNSURE", "NO_RUSH", 3, 2, "FAMILY_LIVING", "EASYGOING"],
  ["F5", "FAMILY", "HEAVY", "FINE", "NONE", "OK", "NIGHT_ALONE", 2, 2, "FAMILY_LIVING", "QUIET"],
  ["F6", "FAMILY", "OK", "EXHAUSTED", "WORKING", "DEBT", "ON_PLAN", 2, 2, "FAMILY_LIVING", "DILIGENT"],

  // 건강·정서 — health >= 2 이고 employment 이상
  ["H1", "ALONE", "HEAVY", "EXHAUSTED", "WORKING", "OK", "NIGHT_ALONE", 4, 0, "HEALTH_EMOTION", "QUIET"],
  ["H2", "ALONE", "UPDOWN", "SOMETIMES", "SEEKING", "OK", "WITH_CLOSE", 2, 1, "HEALTH_EMOTION", "WARM"],
  ["H3", "SHARE", "HEAVY", "FINE", "NONE", "OK", "ON_PLAN", 2, 2, "HEALTH_EMOTION", "DILIGENT"],
  ["H4", "ALONE", "FLAT", "NEED_CARE", "PART", "TIGHT", "NO_RUSH", 3, 2, "HEALTH_EMOTION", "EASYGOING"],
  ["H5", "OTHER", "HEAVY", "EXHAUSTED", "NONE", "DEBT", "NIGHT_ALONE", 4, 4, "HEALTH_EMOTION", "QUIET"],
  ["H6", "ALONE", "UPDOWN", "NEED_CARE", "WORKING", "UNSURE", "WITH_CLOSE", 3, 1, "HEALTH_EMOTION", "WARM"],

  // 독립거주·저소득 — 그 외. 전부 0인 경우의 기본값도 여기다
  ["I1", "ALONE", "OK", "FINE", "NONE", "DEBT", "ON_PLAN", 0, 4, "INDEPENDENT_LOW_INCOME", "DILIGENT"],
  ["I2", "ALONE", "UPDOWN", "FINE", "NONE", "TIGHT", "NIGHT_ALONE", 1, 3, "INDEPENDENT_LOW_INCOME", "QUIET"],
  ["I3", "SHARE", "HEAVY", "FINE", "NONE", "DEBT", "NO_RUSH", 2, 4, "INDEPENDENT_LOW_INCOME", "EASYGOING"],
  ["I4", "ALONE", "OK", "FINE", "WORKING", "OK", "WITH_CLOSE", 0, 0, "INDEPENDENT_LOW_INCOME", "WARM"],
  ["I5", "OTHER", "FLAT", "SOMETIMES", "NONE", "DEBT", "ON_PLAN", 2, 4, "INDEPENDENT_LOW_INCOME", "DILIGENT"],
  ["I6", "ALONE", "UPDOWN", "SOMETIMES", "SEEKING", "DEBT", "WITH_CLOSE", 2, 3, "INDEPENDENT_LOW_INCOME", "WARM"],
]

/** 표는 문항 접두사를 생략해 적었다. SHARE → { questionCode: "Q1", choiceCode: "Q1_SHARE" } */
function answersOf(row: Row): Answer[] {
  return row.slice(1, 7).map((suffix, index) => ({
    questionCode: `Q${index + 1}`,
    choiceCode: `Q${index + 1}_${suffix}`,
  }))
}

for (const row of ROWS) {
  const [id, , , , , , , health, employment, typeCode, adjective] = row
  const result = classify(answersOf(row))

  assert.equal(result.typeCode, typeCode, `${id} 유형`)
  assert.equal(result.adjective, adjective, `${id} 형용사`)
  assert.equal(result.axisScores.health, health, `${id} health 점수`)
  assert.equal(result.axisScores.employment, employment, `${id} employment 점수`)
}

// H3과 I3은 Q5만 다르다. 동점 경계가 어디서 뒤집히는지 확인하는 쌍이다.
assert.notEqual(
  classify(answersOf(ROWS.find((r) => r[0] === "H3")!)).typeCode,
  classify(answersOf(ROWS.find((r) => r[0] === "I3")!)).typeCode,
)

// 이상 입력은 모두 throw한다. 판정하지 않고 API가 INVALID_ANSWER로 응답한다.
const FULL = answersOf(ROWS[0])

assert.throws(() => classify(FULL.slice(0, 5)), /INVALID_ANSWER/, "Q6 누락")
assert.throws(
  () => classify([...FULL.slice(0, 1), { questionCode: "Q2", choiceCode: "Q2_UNKNOWN" }, ...FULL.slice(2)]),
  /INVALID_ANSWER/,
  "없는 선택지",
)
assert.throws(
  () => classify([...FULL, { questionCode: "Q3", choiceCode: "Q3_FINE" }]),
  /INVALID_ANSWER/,
  "Q3 중복",
)
assert.throws(() => classify([]), /INVALID_ANSWER/, "빈 배열")
assert.throws(
  () => classify([{ questionCode: "Q1", choiceCode: "Q2_HEAVY" }, ...FULL.slice(1)]),
  /INVALID_ANSWER/,
  "문항과 선택지 불일치",
)

console.log(`diagnosis 체크 통과 (시나리오 ${ROWS.length}개 + 이상 입력 5개)`)
