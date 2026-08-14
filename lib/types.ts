import type { Adjective, TypeCode } from "@prisma/client"

// 소유자: A. 표시 문자열의 유일한 출처다. 화면에 유형명("건강·정서취약형")을 절대 쓰지 않는다.

export const TRIBE: Record<
  TypeCode,
  { family: string; animal: string; colorName: string; colorHex: string }
> = {
  INDEPENDENT_LOW_INCOME: {
    family: "개과",
    animal: "여우",
    colorName: "앰버 오렌지",
    colorHex: "#F59E0B",
  },
  HEALTH_EMOTION: {
    family: "고양잇과",
    animal: "고양이",
    colorName: "라벤더 퍼플",
    colorHex: "#A78BFA",
  },
  FAMILY_LIVING: {
    family: "곰과",
    animal: "곰",
    colorName: "세이지 그린",
    colorHex: "#84A98C",
  },
}

export const ADJECTIVE_LABEL: Record<Adjective, string> = {
  QUIET: "조용한",
  WARM: "다정한",
  DILIGENT: "부지런한",
  EASYGOING: "느긋한",
}

// 진단 6번 문항 선택지 코드 → 형용사. 상수 테이블이며 LLM을 쓰지 않는다.
export const ADJECTIVE_BY_CHOICE: Record<string, Adjective> = {
  Q6_NIGHT_ALONE: "QUIET", // 밤에 혼자 있는 시간이 가장 편하다
  Q6_WITH_CLOSE: "WARM", // 마음 맞는 사람과 있을 때가 편하다
  Q6_ON_PLAN: "DILIGENT", // 계획대로 하루가 굴러가면 편하다
  Q6_NO_RUSH: "EASYGOING", // 서두르지 않고 흐르는 대로가 편하다
}

/** 진단 직후 부여하는 기본 닉네임. 이후 유저가 변경할 수 있다. */
export function defaultNickname(typeCode: TypeCode, adjective: Adjective): string {
  return `${ADJECTIVE_LABEL[adjective]} ${TRIBE[typeCode].animal}`
}

/** 커뮤니티·프로필 작성자 표기. 종족은 변경 불가이므로 항상 함께 노출한다. */
export function authorLabel(nickname: string, typeCode: TypeCode): string {
  return `${nickname} · ${TRIBE[typeCode].family}`
}

export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 12

export function isValidNickname(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length >= NICKNAME_MIN && trimmed.length <= NICKNAME_MAX
}

// 성장 곡선 (SPEC.md 5절)
export const SEED_TO_EXP = 1
export const EVOLUTION_LEVEL = { STAGE2: 5, STAGE3: 15 } as const

export function expToNextLevel(level: number): number {
  return level * 100
}

export function evolutionStageFor(level: number): number {
  if (level >= EVOLUTION_LEVEL.STAGE3) return 3
  if (level >= EVOLUTION_LEVEL.STAGE2) return 2
  return 1
}
