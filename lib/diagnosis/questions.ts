// 문항·선택지·지표의 서버 원본. docs/dev/diagnosis.md 4·5장이 확정 스펙이다.
//
// 클라이언트는 choiceCode만 보낸다. 지표는 서버가 이 표에서 조회한다.
// 클라이언트가 보낸 지표를 신뢰하면 요청 조작으로 원하는 유형을 만들 수 있다.
//
// 문장 기준: 소득·고립·우울을 직설적으로 묻지 않는다. 판정은 코드가 하므로
// 문장을 은유로 바꿔도 정확도는 흔들리지 않는다.

/** 지표 14개. 전부 boolean. 판정 함수는 이것만 본다. */
export type Indicator =
  | "ALONE" //             ① 1인 가구
  | "HOUSING_UNSTABLE" //  ② 주거 불안정
  | "MENTAL_UNMET" //      ③ 정신건강 진료 미충족
  | "PHYSICAL_UNMET" //    ④ 신체건강 진료 미충족
  | "DEPRESSED" //         ⑤ 우울 (PHQ-2 근사. 선택지가 직접 켜지 않고 phq 합에서 파생된다)
  | "ACTIVITY_LIMIT" //    ⑥ 건강으로 인한 활동 제약
  | "BURNOUT" //           ⑦ 소진
  | "LOW_INCOME" //        ⑧ 저소득
  | "DEBT" //              ⑨ 개인부채
  | "COLLEGE" //           ⑩ 대학 진학 (판정에 쓰지 않는다. 통계용)
  | "JOBLESS" //           ⑪ 미취업
  | "AFTERCARE" //         ⑫ 자립준비(보호종료)
  | "MIGRANT" //           ⑬ 지역 이주
  | "CAREGIVER" //         ⑭ 가족 돌봄

export const INDICATORS: Indicator[] = [
  "ALONE",
  "HOUSING_UNSTABLE",
  "MENTAL_UNMET",
  "PHYSICAL_UNMET",
  "DEPRESSED",
  "ACTIVITY_LIMIT",
  "BURNOUT",
  "LOW_INCOME",
  "DEBT",
  "COLLEGE",
  "JOBLESS",
  "AFTERCARE",
  "MIGRANT",
  "CAREGIVER",
]

/** health 파생 점수에 들어가는 지표 */
export const HEALTH_INDICATORS: Indicator[] = [
  "MENTAL_UNMET",
  "PHYSICAL_UNMET",
  "DEPRESSED",
  "ACTIVITY_LIMIT",
  "BURNOUT",
]

/** econ 파생 점수에 들어가는 지표 */
export const ECON_INDICATORS: Indicator[] = ["HOUSING_UNSTABLE", "LOW_INCOME", "DEBT", "JOBLESS"]

export type Choice = {
  code: string
  label: string
  /** 이 선택지가 켜는 지표. DEPRESSED는 여기 넣지 않는다 */
  flags?: Indicator[]
  /** PHQ-2 점수. Q3·Q4만 가진다. 두 문항 합이 3 이상이면 DEPRESSED */
  phq?: 0 | 1 | 2
}

export type Question = {
  code: string
  text: string
  choices: Choice[]
}

/** 형용사 전용 문항. 지표가 없고 항상 마지막에 묻는다 */
export const ADJECTIVE_QUESTION_CODE = "Q13"

export const QUESTIONS: Question[] = [
  {
    code: "Q1",
    text: "지금 집 현관을 열면, 누가 있나요?",
    choices: [
      { code: "Q1_FAMILY", label: "가족이 있어요" },
      { code: "Q1_ALONE", label: "저 혼자예요", flags: ["ALONE"] },
      { code: "Q1_SHARE", label: "친구나 룸메이트가 있어요", flags: ["ALONE"] },
      { code: "Q1_OTHER", label: "그 외예요", flags: ["ALONE"] },
    ],
  },
  {
    code: "Q2",
    text: "지금 사는 곳을 떠올리면 마음이 어떤가요?",
    choices: [
      { code: "Q2_RISK", label: "다음 달에도 여기 있을 수 있을지 모르겠어요", flags: ["HOUSING_UNSTABLE"] },
      { code: "Q2_BILL", label: "고지서나 월세 날짜가 마음에 걸려요", flags: ["HOUSING_UNSTABLE"] },
      { code: "Q2_TIGHT", label: "좁지만 지낼 만해요" },
      { code: "Q2_SAFE", label: "여기 있으면 마음이 놓여요" },
    ],
  },
  {
    code: "Q3",
    text: "예전에 좋아했던 것들은 요즘 어떤가요?",
    choices: [
      { code: "Q3_NONE", label: "뭘 해도 재미가 없어요", phq: 2 },
      { code: "Q3_LESS", label: "예전만큼은 아니에요", phq: 1 },
      { code: "Q3_MIXED", label: "그때그때 달라요", phq: 1 },
      { code: "Q3_SAME", label: "여전히 좋아요", phq: 0 },
    ],
  },
  {
    code: "Q4",
    text: "아침에 눈을 떴을 때 하루가 어떻게 느껴지나요?",
    choices: [
      { code: "Q4_HEAVY", label: "다시 눈을 감고 싶어요", phq: 2 },
      { code: "Q4_DRAG", label: "무겁지만 일단 일어나요", phq: 1 },
      { code: "Q4_FLAT", label: "특별한 느낌이 없어요", phq: 1 },
      { code: "Q4_OK", label: "대체로 괜찮아요", phq: 0 },
    ],
  },
  {
    code: "Q5",
    text: "쉬고 난 다음 날, 몸과 마음이 돌아오나요?",
    choices: [
      { code: "Q5_EMPTY", label: "자도 자도 바닥이에요", flags: ["BURNOUT"] },
      { code: "Q5_HALF", label: "절반쯤만 돌아와요", flags: ["BURNOUT"] },
      { code: "Q5_MOST", label: "대체로 돌아와요" },
      { code: "Q5_FULL", label: "잘 돌아와요" },
    ],
  },
  {
    code: "Q6",
    text: "가봐야 하는데 못 간 곳이 있나요?",
    choices: [
      { code: "Q6_MENTAL", label: "마음을 털어놓을 곳을 못 찾았어요", flags: ["MENTAL_UNMET"] },
      { code: "Q6_BODY", label: "몸이 안 좋은데 병원을 못 갔어요", flags: ["PHYSICAL_UNMET"] },
      { code: "Q6_BOTH", label: "둘 다 미루고 있어요", flags: ["MENTAL_UNMET", "PHYSICAL_UNMET"] },
      { code: "Q6_NONE", label: "지금은 없어요" },
    ],
  },
  {
    code: "Q7",
    // "가끔"까지 활동 제약으로 잡으면 health가 과대해져 건강·정서취약형이 논문의 12%를 크게 넘는다
    text: "몸 상태 때문에 하려던 일을 접은 적이 있나요?",
    choices: [
      { code: "Q7_OFTEN", label: "자주 그래요", flags: ["ACTIVITY_LIMIT"] },
      { code: "Q7_SOME", label: "가끔 그래요" },
      { code: "Q7_RARE", label: "거의 없어요" },
      { code: "Q7_NONE", label: "없어요" },
    ],
  },
  {
    code: "Q8",
    text: "이번 달 통장을 볼 때 마음이 어떤가요?",
    choices: [
      { code: "Q8_FEAR", label: "월말이 오는 게 겁나요", flags: ["LOW_INCOME"] },
      { code: "Q8_JUST", label: "아끼면 겨우 맞아요", flags: ["LOW_INCOME"] },
      { code: "Q8_FINE", label: "크게 신경 쓰지 않아요" },
      { code: "Q8_ROOM", label: "여유가 좀 있어요" },
    ],
  },
  {
    code: "Q9",
    // 회피는 부채 없음보다 부채 있음에 가깝고, 잘못 켰을 때 피해가 작다(경제 미션이 배정될 뿐이다)
    text: "갚아야 할 것이 마음에 걸리나요?",
    choices: [
      { code: "Q9_HEAVY", label: "생각하면 잠이 안 와요", flags: ["DEBT"] },
      { code: "Q9_SOME", label: "조금 있어요", flags: ["DEBT"] },
      { code: "Q9_UNSURE", label: "생각하고 싶지 않아요", flags: ["DEBT"] },
      { code: "Q9_NONE", label: "없어요" },
    ],
  },
  {
    code: "Q10",
    text: "요즘 하루는 어떻게 채워지나요?",
    choices: [
      { code: "Q10_EMPTY", label: "딱히 정해진 게 없어요", flags: ["JOBLESS"] },
      { code: "Q10_SEEK", label: "일자리를 찾아보고 있어요", flags: ["JOBLESS"] },
      { code: "Q10_SHORT", label: "짧게라도 일하고 있어요" },
      { code: "Q10_FIXED", label: "정해진 곳에 나가요" },
    ],
  },
  {
    code: "Q11",
    // 한 문항이 ⑩⑫⑬을 나눠 잡는다. 세 사건이 동시에 해당되는 경우를 포기하고 문항 2개를 아꼈다
    text: "스무 살 무렵, 어디에서 나와 지금까지 왔나요?",
    choices: [
      { code: "Q11_COLLEGE", label: "대학을 다니다 왔어요", flags: ["COLLEGE"] },
      { code: "Q11_AFTERCARE", label: "시설이나 위탁가정에서 나왔어요", flags: ["AFTERCARE"] },
      { code: "Q11_MIGRANT", label: "살던 지역을 떠나 혼자 왔어요", flags: ["MIGRANT"] },
      { code: "Q11_STAY", label: "쭉 살던 곳에 있어요" },
    ],
  },
  {
    code: "Q12",
    text: "집에서 당신이 챙겨야 하는 사람이 있나요?",
    choices: [
      { code: "Q12_MAIN", label: "제가 없으면 안 되는 사람이 있어요", flags: ["CAREGIVER"] },
      { code: "Q12_HELP", label: "조금 거들어요" },
      { code: "Q12_NONE", label: "없어요" },
    ],
  },
  {
    code: ADJECTIVE_QUESTION_CODE,
    text: "어떤 때가 가장 편한가요?",
    choices: [
      { code: "Q13_NIGHT_ALONE", label: "밤에 혼자 있는 시간이 가장 편해요" },
      { code: "Q13_WITH_CLOSE", label: "마음 맞는 사람과 있을 때가 편해요" },
      { code: "Q13_ON_PLAN", label: "계획대로 하루가 굴러가면 편해요" },
      { code: "Q13_NO_RUSH", label: "서두르지 않고 흐르는 대로가 편해요" },
    ],
  },
]

/** 지표를 만드는 문항만. 조기 종료 계산 대상이다 */
export const INDICATOR_QUESTIONS = QUESTIONS.filter((q) => q.code !== ADJECTIVE_QUESTION_CODE)

export const QUESTION_BY_CODE: Record<string, Question> = Object.fromEntries(
  QUESTIONS.map((question) => [question.code, question]),
)

/** choiceCode → 문항·선택지. 서버가 지표를 조회하는 유일한 경로 */
export const CHOICE_INDEX: Record<string, { question: Question; choice: Choice }> = Object.fromEntries(
  QUESTIONS.flatMap((question) =>
    question.choices.map((choice) => [choice.code, { question, choice }] as const),
  ),
)
