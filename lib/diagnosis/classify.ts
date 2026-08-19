// 유형 판정. docs/dev/diagnosis.md 6·7장이 확정 스펙이다.
// 순수 함수. DB·LLM 없음. LLM은 문장 다듬기와 자유 입력 변환만 담당한다.
//
// 대분류(사용자)와 세부유형(관리자)은 서로를 참조하지 않는다. 둘 다 지표만 본다.
// 세부유형에서 대분류를 고정 매핑으로 뽑으면 미취업빈곤형처럼 주거에 따라
// 갈려야 하는 유형이 한 집단에 몰려 미션 배정이 틀린다.

import type { Adjective, SubTypeCode, TypeCode } from "@prisma/client"
import { ADJECTIVE_BY_CHOICE } from "../types"
import { type Answer, type Indicators, resolveIndicators } from "./indicators"

export type { Answer, Indicators } from "./indicators"

export type DiagnosisResult = {
  typeCode: TypeCode
  adjective: Adjective
  subTypeCode: SubTypeCode
  indicators: Indicators
  health: number
  econ: number
}

/**
 * 대분류 3유형. 사용자에게는 동물로만 보여준다.
 *
 * 규칙 1이 가족 동거보다 앞이다. 가족과 살아도 건강 지표 5개 중 3개가 켜졌으면
 * 건강·정서취약형이다. Q1 하나로 가족 동거를 확정하면 가족과 사는 심한 우울
 * 사용자가 가장 낮은 강도의 미션을 못 받는다.
 */
export function classifyType(alone: boolean, health: number, econ: number): TypeCode {
  if (health >= 3) return "HEALTH_EMOTION"
  if (!alone) return "FAMILY_LIVING"
  // 동점이면 HEALTH. 방치했을 때 위험이 크고 미션 강도가 낮아 오판정 피해가 작다
  if (health >= 2 && health >= econ) return "HEALTH_EMOTION"
  return "INDEPENDENT_LOW_INCOME"
}

/**
 * 세부 8유형. 관리자 전용. 화면에 노출하지 않는다.
 *
 * 사실 유형(자립준비·가족돌봄·지역이주)이 맨 앞이다. 외부 지원 제도가 따로 있어
 * 관리자가 연계할 때 이 사실이 다른 취약성보다 먼저다.
 */
export function classifySubType(indicators: Indicators, health: number): SubTypeCode {
  if (indicators.AFTERCARE) return "AFTERCARE_YOUTH"
  if (indicators.CAREGIVER) return "FAMILY_CAREGIVER"
  if (indicators.MIGRANT) return "MIGRANT_YOUTH"
  if (health >= 3) return "HEALTH_FRAGILE"

  const moneyStress = indicators.LOW_INCOME || indicators.HOUSING_UNSTABLE
  if (indicators.DEBT && moneyStress) {
    return indicators.ALONE ? "DEBT_INDEPENDENT" : "FINANCIAL_FRAGILE"
  }
  if (indicators.JOBLESS && indicators.LOW_INCOME) return "JOBLESS_POOR"
  return "FAMILY_DEPENDENT"
}

/** 진단 완료. 형용사 문항(Q13)이 없으면 닉네임을 만들 수 없으므로 거부한다 */
export function classify(answers: Answer[]): DiagnosisResult {
  const { indicators, adjectiveChoice, health, econ } = resolveIndicators(answers)

  if (!adjectiveChoice) throw new Error("INVALID_ANSWER: 형용사 문항(Q13) 누락")
  const adjective = ADJECTIVE_BY_CHOICE[adjectiveChoice]
  if (!adjective) throw new Error(`INVALID_ANSWER: 형용사 매핑 없음 ${adjectiveChoice}`)

  return {
    typeCode: classifyType(indicators.ALONE, health, econ),
    adjective,
    subTypeCode: classifySubType(indicators, health),
    indicators,
    health,
    econ,
  }
}
