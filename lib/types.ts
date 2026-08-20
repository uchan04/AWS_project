import type { Adjective, TypeCode } from "@prisma/client"

// 소유자: A. 표시 문자열의 유일한 출처다. 화면에 유형명("건강·정서취약형")을 절대 쓰지 않는다.

// 색은 여기 한 곳에만 있다. 톤을 바꾸기로 하면 colorHex 3개만 교체한다.
// 값의 출처는 Figma 프로토타입(isol-design_Figma README "디자인 규칙" 절)이다.
// 이전 값(#F59E0B / #38BDF8 / #34D399)은 종이색 배경 #F5F0E8에서 형광으로 떠서 버렸다.
// 같은 색을 styles/tokens.css의 [data-tribe] 규칙이 들고 있다. 한쪽만 바꾸지 않는다.
// emoji는 펫 이미지가 S3에 올라오기 전까지 쓰는 마스코트 자리다. 항상 aria-hidden으로 넣는다.
export const TRIBE: Record<
  TypeCode,
  { family: string; animal: string; emoji: string; colorName: string; colorHex: string }
> = {
  HEALTH_EMOTION: {
    family: "개과",
    animal: "여우",
    emoji: "🦊",
    colorName: "노을 주황",
    colorHex: "#E8956A",
  },
  INDEPENDENT_LOW_INCOME: {
    family: "고양잇과",
    animal: "고양이",
    emoji: "🐱",
    colorName: "새벽 파랑",
    colorHex: "#6A95C8",
  },
  FAMILY_LIVING: {
    family: "곰과",
    animal: "곰",
    emoji: "🐻",
    colorName: "이끼 초록",
    colorHex: "#7AAE82",
  },
}

export const ADJECTIVE_LABEL: Record<Adjective, string> = {
  QUIET: "조용한",
  WARM: "다정한",
  DILIGENT: "부지런한",
  EASYGOING: "느긋한",
}

// 형용사 문항(Q13) 선택지 코드 → 형용사. 상수 테이블이며 LLM을 쓰지 않는다.
export const ADJECTIVE_BY_CHOICE: Record<string, Adjective> = {
  Q13_NIGHT_ALONE: "QUIET", // 밤에 혼자 있는 시간이 가장 편하다
  Q13_WITH_CLOSE: "WARM", // 마음 맞는 사람과 있을 때가 편하다
  Q13_ON_PLAN: "DILIGENT", // 계획대로 하루가 굴러가면 편하다
  Q13_NO_RUSH: "EASYGOING", // 서두르지 않고 흐르는 대로가 편하다
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
// 2026-08-19: 씨앗 1 = 경험치 1 → 10으로 변경. 유일한 소비자는 lib/pet.ts의 applySeeds()다.
// 값을 고치면 scripts/check-pet.ts의 기대값이 함께 바뀐다. npm run check:pet 을 반드시 돌린다.
export const SEED_TO_EXP = 10
export const EVOLUTION_LEVEL = { STAGE2: 5, STAGE3: 15 } as const

export function expToNextLevel(level: number): number {
  return level * 100
}

export function evolutionStageFor(level: number): number {
  if (level >= EVOLUTION_LEVEL.STAGE3) return 3
  if (level >= EVOLUTION_LEVEL.STAGE2) return 2
  return 1
}
