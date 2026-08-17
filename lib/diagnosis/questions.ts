// 소유자: A. 진단 6문항의 유일한 원본 (docs/dev/diagnosis.md 4장, SPEC.md 3절).
//
// 서버는 클라이언트가 보낸 choiceCode만 신뢰하고 axis·weight는 여기서 조회한다.
// 클라이언트가 보낸 weight를 그대로 쓰면 요청을 조작해 원하는 유형을 만들 수 있다.
//
// weight는 그 답변이 해당 축의 어려움을 얼마나 강하게 나타내는가다.
//   0 = 신호 없음 / 1 = 약한 신호 / 2 = 강한 신호

export type Axis = "housing" | "health" | "employment"

export type Choice = {
  code: string
  label: string
  weight: number
}

export type Question = {
  code: string
  /** 화면에 띄우는 문장. Bedrock으로 다듬을 때도 이 문장이 폴백이다. */
  text: string
  /** Q6은 형용사 전용이라 축이 없다. */
  axis: Axis | null
  choices: Choice[]
}

export const QUESTIONS: Question[] = [
  {
    code: "Q1",
    text: "지금 누구와 함께 살고 있나요?",
    axis: "housing",
    choices: [
      { code: "Q1_FAMILY", label: "가족과 함께 살아요", weight: 0 },
      { code: "Q1_ALONE", label: "혼자 살아요", weight: 2 },
      { code: "Q1_SHARE", label: "친구나 룸메이트와 살아요", weight: 1 },
      { code: "Q1_OTHER", label: "그 외예요", weight: 1 },
    ],
  },
  {
    code: "Q2",
    text: "요즘 하루하루 기분은 어떤가요?",
    axis: "health",
    choices: [
      { code: "Q2_HEAVY", label: "대체로 가라앉아 있어요", weight: 2 },
      { code: "Q2_UPDOWN", label: "좋을 때도 있고 아닐 때도 있어요", weight: 1 },
      { code: "Q2_FLAT", label: "특별한 감정 변화가 없어요", weight: 1 },
      { code: "Q2_OK", label: "대체로 괜찮아요", weight: 0 },
    ],
  },
  {
    code: "Q3",
    text: "몸 상태나 병원은 어떤가요?",
    axis: "health",
    choices: [
      { code: "Q3_EXHAUSTED", label: "늘 지쳐 있고 회복이 안 돼요", weight: 2 },
      { code: "Q3_NEED_CARE", label: "가봐야 할 것 같은데 못 가고 있어요", weight: 2 },
      { code: "Q3_SOMETIMES", label: "가끔 힘들지만 넘길 수 있어요", weight: 1 },
      { code: "Q3_FINE", label: "특별히 불편한 건 없어요", weight: 0 },
    ],
  },
  {
    code: "Q4",
    text: "요즘 일이나 구직은 어떤가요?",
    axis: "employment",
    choices: [
      { code: "Q4_NONE", label: "일하지 않고 구직도 쉬고 있어요", weight: 2 },
      { code: "Q4_SEEKING", label: "구직 중이에요", weight: 1 },
      { code: "Q4_PART", label: "아르바이트나 단기 일을 해요", weight: 1 },
      { code: "Q4_WORKING", label: "일정하게 일하고 있어요", weight: 0 },
    ],
  },
  {
    code: "Q5",
    text: "돈 문제는 어떤가요?",
    axis: "employment",
    choices: [
      { code: "Q5_DEBT", label: "갚아야 할 돈이 부담돼요", weight: 2 },
      { code: "Q5_TIGHT", label: "생활비가 빠듯해요", weight: 1 },
      { code: "Q5_UNSURE", label: "생각하고 싶지 않아요", weight: 1 },
      { code: "Q5_OK", label: "크게 걱정은 없어요", weight: 0 },
    ],
  },
  {
    code: "Q6",
    text: "어떤 때가 가장 편한가요?",
    axis: null,
    choices: [
      { code: "Q6_NIGHT_ALONE", label: "밤에 혼자 있는 시간이 가장 편해요", weight: 0 },
      { code: "Q6_WITH_CLOSE", label: "마음 맞는 사람과 있을 때가 편해요", weight: 0 },
      { code: "Q6_ON_PLAN", label: "계획대로 하루가 굴러가면 편해요", weight: 0 },
      { code: "Q6_NO_RUSH", label: "서두르지 않고 흐르는 대로가 편해요", weight: 0 },
    ],
  },
]

export const QUESTION_COUNT = QUESTIONS.length

/** 선택지 코드 → 소속 문항·선택지. 판정과 검증이 전부 이 조회를 거친다. */
export const CHOICE_INDEX: Record<string, { question: Question; choice: Choice }> =
  Object.fromEntries(
    QUESTIONS.flatMap((question) =>
      question.choices.map((choice) => [choice.code, { question, choice }] as const),
    ),
  )
