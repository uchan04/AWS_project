import type { Prisma, TypeCode } from "@prisma/client"
import {
  BAND_COUNT,
  MISSIONS_PER_STAGE,
  STAGES_PER_BAND,
  TOTAL_STAGES,
  bandOf,
  rewardForStage,
} from "../../lib/missions/bands"

// 소유자: A. 단계 미션 100단계 커리큘럼.
//
// ─── 왜 이렇게 만드는가 ───────────────────────────────────────────────
// 100단계 × 3미션 = 유형당 300슬롯이다. 300개를 다 새로 쓰면 (a) 문구 품질이
// 무너지고 (b) 미션이 단발성이 된다 — 한 번 하고 끝나면 습관이 되지 않는다.
//
// 그래서 고유 미션 120개를 만들고 300슬롯에 재등장시킨다(평균 2.5회).
// 재등장 간격은 두 종류를 섞는다.
//   · 최근 복습 — 직전 3단계에 처음 나온 것. 짧은 간격의 재노출로 몸에 붙인다
//   · 다지기 복습 — 전체에서 가장 오래 안 한 것(LRU). 방 안 미션도 90단계에서
//                   다시 돌아온다. 기초 습관이 무너지지 않게 하는 장치다
//
// 무작위를 쓰지 않는다. 같은 유형이면 누구나 같은 단계에서 같은 미션을 본다 —
// 재현 가능해야 문구 오류를 잡을 수 있고, 시드를 다시 돌려도 배치가 바뀌지 않는다.
//
// ─── 작성량 ───────────────────────────────────────────────────────
//   공용 90개 (구간당 9개 × 10구간) — 3유형이 공유
//   유형별 30개 (구간당 3개 × 10구간) × 3유형 = 90개
//   실제 작성 180개 → 유형당 노출 120개
//
// 문구 규칙(SPEC.md 4절): 명령형을 쓰지 않는다. "~해봐요", "~해도 괜찮아요".
// 실패할 수 있는 여지를 항상 남긴다 — "사지 않아도 괜찮아요"가 그 장치다.

type PoolMission = {
  /** 재등장 추적용 키. code에는 쓰지 않는다(같은 미션이 여러 단계에 놓이므로) */
  key: string
  title: string
  desc: string
  /** 사진 인증 미션. 밖에 나간 것 자체가 증거가 되는 미션에만 붙인다 */
  photo?: true
}

function m(key: string, title: string, desc: string, photo?: true): PoolMission {
  return photo ? { key, title, desc, photo } : { key, title, desc }
}

// ─────────────────────────────────────────────────────────────────────
// 공용 풀 — 구간 1~10, 각 9개
// ─────────────────────────────────────────────────────────────────────

const SHARED: PoolMission[][] = [
  // 구간 1 (1~10) 방 안에서 — 몸을 돌보는 최소 행동. 침대에서 일어나지 않아도 되는 것부터
  [
    m("S_BED", "이불 정리하기", "일어난 자리를 손으로 한 번만 펴줘요."),
    m("S_WATER", "물 한 컵 마시기", "지금 한 잔만 마셔요. 미지근한 물도 좋아요."),
    m("S_CURTAIN", "커튼 열기", "커튼을 열어 빛만 들여봐요. 창밖을 안 봐도 괜찮아요."),
    m("S_STRETCH", "기지개 한 번", "팔을 위로 뻗고 크게 펴봐요."),
    m("S_WASH", "세수하기", "얼굴에 물만 묻혀도 충분해요."),
    m("S_MOOD", "기분 한 단어로 적기", "좋다, 별로다, 모르겠다 중 하나여도 괜찮아요."),
    m("S_BREATH", "5분 숨 고르기", "눈을 감고 천천히 숨만 쉬어봐요."),
    m("S_TEETH", "양치하기", "30초만 해도 좋아요."),
    m("S_FOOT", "발끝 당기기", "앉아서 발끝을 몸쪽으로 천천히 당겨봐요."),
  ],

  // 구간 2 (11~20) 집 안 생활 — 공간을 관리하기 시작한다. 아직 문은 열지 않는다
  [
    m("S_AIR", "창문 열고 환기하기", "5분만 공기를 바꿔봐요."),
    m("S_DISH", "그릇 하나 씻기", "쌓인 것 중 하나만 씻어봐요."),
    m("S_TRASH_TIE", "쓰레기 한 봉지 묶기", "버리지 않아도 돼요. 묶어두기만 해도 충분해요."),
    m("S_FLOOR", "바닥 한 곳 닦기", "손바닥만한 곳 하나만 닦아봐요."),
    m("S_CLOTHES", "옷 갈아입기", "잠옷에서 다른 옷으로 한 번만 바꿔봐요."),
    m("S_INDOOR_WALK", "집 안 15분 걷기", "방과 거실을 천천히 왕복해요."),
    m("S_WARM_MEAL", "따뜻한 것 먹기", "라면이나 계란 하나여도 충분해요."),
    m("S_DESK", "책상 위 하나 치우기", "물건 하나만 제자리에 놓아봐요."),
    m("S_WINDOW_WATCH", "창밖 3분 보기", "지나가는 것만 세어봐도 좋아요."),
  ],

  // 구간 3 (21~30) 문 앞까지 — 경계를 넘는 연습. 나가는 게 아니라 문을 여는 것이 목표다
  [
    m("S_DOOR_OPEN", "현관문 열어두기", "1분만 열어둬요. 나가지 않아도 괜찮아요."),
    m("S_DOOR_STAND", "현관 밖에 1분 서 있기", "문 앞에 그냥 서 있기만 해요."),
    m("S_HALL", "복도 왕복하기", "집 앞 복도만 한 번 다녀와요."),
    m("S_MAILBOX", "우편함 확인하기", "쌓인 우편물을 한 번만 확인해봐요."),
    m("S_RECYCLE", "분리수거 내놓기", "한 봉지만 내놓아도 충분해요."),
    m("S_STAIRS", "계단 한 층 오르기", "한 층만 오르내려도 좋아요."),
    m("S_SHOES", "신발 신고 5분 있기", "나가지 않아도 좋아요. 신어보기만 해요."),
    m("S_DOOR_BREATH", "현관에서 숨 세 번", "문을 열고 숨 세 번만 쉬어봐요."),
    m("S_LISTEN", "밖 소리 들어보기", "창문을 열고 3분만 귀 기울여봐요."),
  ],

  // 구간 4 (31~40) 동네 한 바퀴 — 처음으로 밖에 머문다. 목적지를 만들지 않는다
  [
    m("S_FRONT_WALK", "집 앞 5분 걷기", "건물 앞만 왕복해도 충분해요."),
    m("S_BLOCK", "동네 한 바퀴", "천천히 걸어도 좋아요. 10분만 걸어봐요."),
    m("S_SKY", "하늘 한 장 찍기", "밖에서 올려다본 하늘을 찍어봐요.", true),
    m("S_CVS_FRONT", "편의점 앞까지 가보기", "들어가지 않아도 괜찮아요."),
    m("S_BENCH", "벤치에 5분 앉기", "앉아만 있어도 충분해요."),
    m("S_OTHER_WAY", "다른 길로 돌아오기", "늘 가던 길 말고 옆길로 와봐요."),
    m("S_MORNING_OUT", "해 있을 때 나가기", "낮에 10분만 밖에 있어봐요."),
    m("S_TREE", "동네 나무 한 장", "지나가다 본 나무나 화단을 찍어봐요.", true),
    m("S_WALK20", "20분 걷기", "쉬면서 걸어도 좋아요."),
  ],

  // 구간 5 (41~50) 가게와 시설 — 공간에 들어간다. 아직 말은 하지 않아도 된다
  [
    m("S_CVS_IN", "편의점 들어가보기", "사지 않고 나와도 괜찮아요."),
    m("S_BUY_ONE", "물건 하나 사기", "가장 싼 것 하나여도 좋아요. 산 것을 찍어봐요.", true),
    m("S_PUBLIC", "도서관이나 주민센터 들어가보기", "들어가만 봐도 충분해요. 입구를 찍어봐요.", true),
    m("S_CAFE_DRINK", "밖에서 한 잔 마시기", "물이어도 좋아요. 마신 자리를 찍어봐요.", true),
    m("S_KIOSK", "무인 기기로 결제하기", "키오스크나 무인점포도 좋아요."),
    m("S_PARK30", "밖에 30분 있기", "공원이나 도서관 자리에 앉아 있던 자리를 찍어봐요.", true),
    m("S_MART", "마트 한 바퀴", "장바구니 없이 둘러만 봐도 좋아요."),
    m("S_CLINIC_FIND", "병원이나 약국 위치 확인", "들어가지 않고 위치만 봐도 충분해요."),
    m("S_EAT_OUT", "밖에서 한 끼 먹기", "김밥 하나여도 좋아요. 먹은 자리를 찍어봐요.", true),
  ],

  // 구간 6 (51~60) 조금 더 멀리 — 동네를 벗어난다. 이동 수단을 쓴다
  [
    m("S_BUS_STOP", "정류장까지 가보기", "타지 않아도 괜찮아요."),
    m("S_BUS_ONE", "한 정거장 타보기", "버스나 지하철 한 구간만 타봐요. 내린 곳을 찍어봐요.", true),
    m("S_SUBWAY", "지하철 타보기", "두 구간만 타도 충분해요. 역 이름을 찍어봐요.", true),
    m("S_OUT_TOWN", "동네 밖으로 나가보기", "처음 보는 동네를 한 장 찍어봐요.", true),
    m("S_HOUR_OUT", "1시간 밖에 있기", "앉아 있어도 좋아요."),
    m("S_NEW_ROAD", "처음 가는 길 걸어보기", "돌아올 길만 기억해두면 충분해요."),
    m("S_DESTINATION", "목적지 정해서 다녀오기", "가고 싶은 곳 하나를 정해 다녀와요. 그곳을 찍어봐요.", true),
    m("S_OUT_READ", "밖에서 30분 보내기", "책이나 영상을 봐도 좋아요."),
    m("S_EVENING_OUT", "저녁에 나가보기", "어두워진 뒤 10분만 걸어봐요."),
  ],

  // 구간 7 (61~70) 한마디 건네기 — 여기서부터 사람이 등장한다. 한 문장으로 끊는다
  [
    m("S_THANKS", "계산할 때 인사하기", "'감사합니다' 한마디만 해봐요."),
    m("S_ORDER", "'이거 주세요' 말해보기", "손으로 가리키고 말만 해도 충분해요."),
    m("S_EYE", "눈 맞추고 인사하기", "1초만 봐도 좋아요."),
    m("S_ASK_WHERE", "위치 물어보기", "'화장실 어디예요' 한마디만 해봐요."),
    m("S_CALL_ASK", "전화로 문의하기", "영업시간만 물어봐도 충분해요."),
    m("S_CAFE_ORDER", "카페에서 주문하기", "받은 음료를 찍어봐요.", true),
    m("S_SIT_PEOPLE", "사람 있는 곳에 앉기", "공원이나 가게에 앉은 자리를 찍어봐요.", true),
    m("S_ELEVATOR", "엘리베이터에서 인사", "고개만 숙여도 충분해요."),
    m("S_HELLO_MSG", "안부 한 줄 보내기", "'잘 지내?' 한마디만 보내봐요."),
  ],

  // 구간 8 (71~80) 대화와 모임 — 주고받는 대화로 넘어간다. 모임은 아직 구경만
  [
    m("S_CALL3", "3분 통화하기", "말하기 어려우면 듣기만 해도 괜찮아요."),
    m("S_REACH_OLD", "오래 못 본 사람에게 연락하기", "읽지 않아도 괜찮아요. 보내는 것까지가 목표예요."),
    m("S_TALK5", "5분 대화하기", "끊겨도 괜찮아요."),
    m("S_FIND_MEETUP", "동네 모임 찾아보기", "검색만 해도 좋아요."),
    m("S_MEETUP_WATCH", "모임에 구경만 가기", "말하지 않아도 괜찮아요. 다녀온 곳을 찍어봐요.", true),
    m("S_ONLINE_MEET", "온라인 모임 참여하기", "카메라를 켜지 않아도 괜찮아요."),
    m("S_COUNSEL_FIND", "상담 창구 알아보기", "전화번호만 적어둬도 충분해요."),
    m("S_INTRO_NAME", "이름 말하고 인사하기", "이름만 말해도 충분해요."),
    m("S_MEAL_WITH", "같이 밥 먹기", "함께 먹은 자리를 찍어봐요.", true),
  ],

  // 구간 9 (81~90) 관계 이어가기 — 한 번이 아니라 두 번째가 목표다. 여기서 관계가 생긴다
  [
    m("S_SAME_PLACE", "같은 곳 두 번 가기", "지난주에 갔던 곳을 다시 가봐요."),
    m("S_MEETUP_2ND", "모임에 두 번째로 가기", "지난번 갔던 곳이면 더 좋아요."),
    m("S_SPEAK_FIRST", "먼저 말 걸어보기", "'안녕하세요' 한마디여도 충분해요."),
    m("S_MAKE_PLAN", "약속 하나 잡기", "날짜만 정해도 좋아요."),
    m("S_KEEP_PLAN", "약속 지키기", "다녀온 자리를 찍어봐요.", true),
    m("S_REGULAR", "정기 활동 한 번 나가기", "매주 열리는 곳 한 번만 가봐요."),
    m("S_REACH_FIRST", "먼저 연락하기", "답장이 없어도 괜찮아요."),
    m("S_HELP_ONE", "도움 한 번 주기", "길 안내 한마디도 충분해요."),
    m("S_GRATITUDE", "고맙다고 말하기", "누구에게든 한 번만 전해봐요."),
  ],

  // 구간 10 (91~100) 사회로 한 걸음 — 배우거나 일하거나 역할을 맡는다. 여기가 종착점이다
  [
    m("S_LEARN_FIND", "배우고 싶은 것 찾아보기", "검색만 해도 충분해요."),
    m("S_CLASS_APPLY", "수업 하나 신청하기", "무료 강의여도 좋아요."),
    m("S_RESUME", "이력서 한 줄 쓰기", "이름과 한 줄만 써도 시작이에요."),
    m("S_CERT_FIND", "자격증이나 교육 알아보기", "목록만 봐도 충분해요."),
    m("S_AGENCY_BOOK", "지원 기관 상담 예약", "전화나 인터넷 신청 중 편한 쪽으로 해요."),
    m("S_INTERVIEW", "상담이나 면접 다녀오기", "다녀온 곳을 찍어봐요.", true),
    m("S_SELF_INTRO", "새 사람에게 자기 소개", "이름과 한 문장이면 충분해요."),
    m("S_TAKE_ROLE", "모임에서 역할 맡기", "정리나 연락 담당 같은 작은 것부터 좋아요."),
    m("S_MONTH_PLAN", "한 달 계획 세우기", "한 줄이어도 괜찮아요."),
  ],
]

// ─────────────────────────────────────────────────────────────────────
// 유형별 풀 — 구간 1~10, 각 3개
//
// 유형 이름은 화면에 절대 나가지 않는다(낙인 위험, CLAUDE.md).
// 여기 코드는 DB 컬럼이고 사용자는 종족 이름(고양이·여우·곰)으로만 본다.
// ─────────────────────────────────────────────────────────────────────

// 독립거주-저소득형 (고양이) — 1인 가구 92%, 저소득 87%, 부채 31%
// 혼자 사는 생활 관리와 지역 자원 활용이 중심이다. 돈을 쓰게 만드는 미션은 두지 않는다
const INDEPENDENT: PoolMission[][] = [
  [
    m("I_FRIDGE", "냉장고 열어보기", "지금 뭐가 있는지 한 번만 확인해봐요."),
    m("I_SPEND", "오늘 쓴 돈 적기", "안 썼다면 0원이라고 적어도 좋아요."),
    m("I_ALARM", "알람 하나 맞추기", "일어날 시간 하나만 정해봐요."),
  ],
  [
    m("I_LAUNDRY", "빨래 한 번 돌리기", "개지 않아도 괜찮아요."),
    m("I_SHOP_LIST", "살 것 적어두기", "한 가지만 적어도 충분해요."),
    m("I_EXPIRY", "유통기한 하나 확인", "하나만 확인해도 좋아요."),
  ],
  [
    m("I_NO_DELIVERY", "배달 대신 나가보기", "안 사고 돌아와도 괜찮아요."),
    m("I_BILL", "고지서 확인하기", "금액만 봐도 충분해요."),
    m("I_PARCEL", "택배 직접 받기", "문 앞에서 받아도 좋아요."),
  ],
  [
    m("I_CHEAP_FIND", "싼 가게 찾아보기", "가격만 비교해봐도 좋아요."),
    m("I_WALK_SHOP", "걸어서 장 보러 가기", "사지 않아도 괜찮아요."),
    m("I_MY_ROUTE", "산책로 하나 정하기", "늘 걷는 길을 하나 정해봐요."),
  ],
  [
    m("I_RECEIPT", "장 보고 영수증 남기기", "산 것과 영수증을 찍어봐요.", true),
    m("I_LIB_CARD", "도서관 회원증 만들기", "신청서만 받아와도 좋아요."),
    m("I_FREE_PLACE", "무료로 쓸 수 있는 곳 찾기", "도서관·주민센터도 좋아요."),
  ],
  [
    m("I_YOUTH_CENTER", "청년센터 위치 확인", "들어가지 않고 앞까지만 가도 충분해요."),
    m("I_THREE_PLACES", "걸어갈 수 있는 곳 세 군데", "지도에 적어만 둬도 좋아요."),
    m("I_CHEAP_MEAL", "저렴한 밥집 찾기", "가본 곳을 찍어봐요.", true),
  ],
  [
    m("I_ASK_PRICE", "가격 물어보기", "'얼마예요' 한마디만 해봐요."),
    m("I_POINT", "적립 요청하기", "'적립해 주세요' 한마디면 충분해요."),
    m("I_COURIER", "택배 기사에게 인사", "'감사합니다' 한마디만 해봐요."),
  ],
  [
    m("I_SOLO_MEETUP", "1인 가구 모임 찾아보기", "검색만 해도 좋아요."),
    m("I_NEIGHBOR", "이웃과 인사하기", "고개만 숙여도 충분해요."),
    m("I_POLICY_ASK", "청년 정책 문의하기", "전화로 물어만 봐도 좋아요."),
  ],
  [
    m("I_REGULAR_SHOP", "단골 가게 만들기", "같은 곳을 두 번 가봐요."),
    m("I_NEIGHBOR_2ND", "이웃과 두 번째 인사", "지난번 마주친 사람이면 좋아요."),
    m("I_PROGRAM_REG", "지역 프로그램 등록", "무료 프로그램도 좋아요."),
  ],
  [
    m("I_HOUSING", "청년 주거 지원 알아보기", "조건만 읽어봐도 충분해요."),
    m("I_INDEPEND_PLAN", "자립 계획 한 줄 쓰기", "6개월 뒤 하고 싶은 것 하나만요."),
    m("I_FINANCE_BOOK", "재무 상담 예약하기", "무료 상담 창구도 있어요."),
  ],
]

// 건강·정서취약형 (여우) — 우울 57%, 소진 85%, 미취업 54%, 의료 미충족 높음
// 세 유형 중 강도를 가장 낮게 잡는다. 몸과 기분의 회복이 사회 활동보다 먼저다
const HEALTH: PoolMission[][] = [
  [
    m("H_WARM_WATER", "따뜻한 물 마시기", "미지근한 물이라도 한 잔 마셔봐요."),
    m("H_EYES_CLOSE", "눈 감고 1분 쉬기", "잠들어도 괜찮아요."),
    m("H_SONG", "좋아하는 노래 한 곡", "한 곡만 끝까지 들어봐요."),
  ],
  [
    m("H_SUN5", "햇빛 5분 쬐기", "창가에 앉아 있어도 충분해요."),
    m("H_SLEEP_LOG", "잠든 시간 적기", "대충 적어도 괜찮아요."),
    m("H_STRETCH3", "3분 스트레칭", "앉아서 해도 좋아요."),
  ],
  [
    m("H_DOOR_SKY", "현관에서 하늘 보기", "고개만 들어봐요."),
    m("H_MEDS", "약 챙겨두기", "먹지 않아도 꺼내두기만 해도 좋아요."),
    m("H_TWO_CUPS", "물 두 잔 마시기", "하루에 나눠 마셔도 괜찮아요."),
  ],
  [
    m("H_SIT_OUT10", "밖에서 10분 앉기", "그늘이라도 좋아요."),
    m("H_SLOW_WALK", "천천히 10분 걷기", "속도는 상관없어요."),
    m("H_FIND_LIKE", "좋아하는 것 하나 찍기", "밖에서 마음에 든 것을 찍어봐요.", true),
  ],
  [
    m("H_HOSPITAL_FIND", "병원 위치 찾아보기", "예약하지 않아도 괜찮아요."),
    m("H_DRINK_OUT", "밖에서 한 잔 마시기", "마신 컵을 찍어봐요. 물이어도 좋아요.", true),
    m("H_COUNSEL_DESK", "상담 창구 알아보기", "청년마음건강 지원도 있어요."),
  ],
  [
    m("H_WALK30", "30분 산책하기", "쉬면서 걸어도 좋아요."),
    m("H_NEW_VIEW", "새로운 풍경 보기", "처음 본 풍경을 찍어봐요.", true),
    m("H_SAME_TIME", "같은 시간에 나가기", "어제와 비슷한 시간이면 충분해요."),
  ],
  [
    m("H_CALL_CLINIC", "병원이나 상담에 전화하기", "예약하지 않고 물어만 봐도 좋아요."),
    m("H_TELL_BODY", "몸 상태 말해보기", "'요즘 피곤해요' 한마디여도 충분해요."),
    m("H_SHORT_GREET", "짧게 인사만 하기", "지나가면서 해도 좋아요."),
  ],
  [
    m("H_SHARE_MIND", "마음 이야기 한 줄", "커뮤니티에 남겨도 좋아요."),
    m("H_COUNSEL_ONCE", "상담 한 번 받아보기", "전화 상담도 상담이에요."),
    m("H_RECOVERY_GROUP", "회복 모임 찾아보기", "온라인 모임도 좋아요."),
  ],
  [
    m("H_COUNSEL_2ND", "상담 두 번째로 가기", "같은 곳이면 더 좋아요."),
    m("H_ROUTINE_WALK", "같은 시간에 산책하기", "정해둔 시간에 나가봐요."),
    m("H_WEEK_MOOD", "일주일 기분 적어보기", "한 단어씩이면 충분해요."),
  ],
  [
    m("H_CHECKUP", "정기 검진 예약하기", "국가검진도 좋아요."),
    m("H_CAN_WORK", "할 수 있는 일 알아보기", "짧은 시간 일도 일이에요."),
    m("H_RECOVERY_PLAN", "회복 계획 세우기", "한 달치만 세워도 충분해요."),
  ],
]

// 가족동거형 (곰) — 가족과 함께 살고, 건강 취약성은 낮지만 미취업 43%
// 집 안에 이미 사람이 있다. 1구간부터 가족과의 접촉을 소재로 쓰고,
// 뒤로 갈수록 "가족 밖의 사람"으로 옮긴다 — 가족에게만 의존하는 상태도 고립이다
const FAMILY: PoolMission[][] = [
  [
    m("F_GREET", "가족에게 인사하기", "'잘 잤어' 한마디만 해봐요."),
    m("F_DOOR_OPEN", "방문 열어두기", "10분만 열어두어도 괜찮아요."),
    m("F_MEAL_TOGETHER", "같이 한 끼 먹기", "한 자리에 앉아만 있어도 충분해요."),
  ],
  [
    m("F_CHORE", "집안일 하나 돕기", "설거지나 분리수거 한 가지만요."),
    m("F_TALK5_FAMILY", "가족과 5분 이야기", "짧게 끊어도 괜찮아요."),
    m("F_TV", "같이 TV 보기", "말하지 않아도 좋아요."),
  ],
  [
    m("F_ERRAND", "심부름 하나 하기", "가까운 곳 하나만 다녀와봐요."),
    m("F_SEND_OFF", "현관까지 배웅하기", "손만 흔들어도 충분해요."),
    m("F_TIDY_HELP", "가족 물건 정리 돕기", "하나만 옮겨도 좋아요."),
  ],
  [
    m("F_WALK_TOGETHER", "같이 산책하기", "말 없이 걸어도 좋아요."),
    m("F_ALONE10", "혼자 10분 걷기", "집 근처만 돌아도 충분해요."),
    m("F_SHOP_FOLLOW", "장보기 따라가기", "따라만 가도 괜찮아요."),
  ],
  [
    m("F_ERRAND_FAR", "가족 심부름 다녀오기", "다녀온 곳을 찍어봐요.", true),
    m("F_SHOP_ALONE", "혼자 장 보기", "한 가지만 사도 충분해요."),
    m("F_EAT_FAMILY", "가족과 외식하기", "함께 먹은 자리를 찍어봐요.", true),
  ],
  [
    m("F_FAR_TOGETHER", "가족과 멀리 나가기", "다녀온 곳을 찍어봐요.", true),
    m("F_ALONE_FAR", "혼자 다녀오기", "혼자 다녀온 곳을 한 장 찍어봐요.", true),
    m("F_ALONE_DEST", "가족 없이 목적지 가기", "가고 싶던 곳 하나면 좋아요."),
  ],
  [
    m("F_SHOP_SPEAK", "가게에서 말해보기", "'이거 주세요' 한마디만 해봐요."),
    m("F_RELATIVE", "친척에게 인사하기", "메시지 한 줄도 좋아요."),
    m("F_NEIGHBOR_GREET", "이웃과 인사하기", "고개만 숙여도 충분해요."),
  ],
  [
    m("F_REAL_TALK", "가족과 10분 대화하기", "가벼운 이야기여도 좋아요."),
    m("F_FRIEND_MSG", "친구에게 연락하기", "답장이 없어도 괜찮아요."),
    m("F_FAMILY_EVENT", "가족 모임에 앉아있기", "말하지 않아도 괜찮아요."),
  ],
  [
    m("F_OUTSIDE_PLAN", "가족 아닌 사람과 약속", "날짜만 정해도 좋아요."),
    m("F_RELATIVE_MEET", "친척 모임 참여하기", "짧게 있다 와도 충분해요."),
    m("F_FRIEND_2ND", "친구와 두 번째 만남", "같은 사람이면 좋아요."),
  ],
  [
    m("F_TELL_PLAN", "가족에게 계획 말하기", "한 문장이면 충분해요."),
    m("F_INDEPEND_FIND", "독립 준비 알아보기", "조건만 읽어봐도 좋아요."),
    m("F_JOB_COUNSEL", "구직 상담 받아보기", "고용센터 상담도 무료예요."),
  ],
]

/**
 * 100단계 전용 미션 3개. 복습이 여기 끼어들지 못하게 따로 둔다.
 *
 * 왜: LRU 복습이 마지막 단계를 채우면 100단계가 "현관에서 하늘 보기"로 끝난다.
 * 100단계는 이 커리큘럼의 종착점 — "정기적으로 나가고, 사람과 약속을 잡고,
 * 다음을 계획하는" 상태다. 그 세 가지를 마지막 세 칸에 그대로 놓는다.
 */
const FINALE: PoolMission[] = [
  m("S_FIN_REGULAR", "정기적으로 갈 곳 정하기", "매주 갈 곳 한 군데를 정해봐요."),
  m("S_FIN_PLAN", "다음 달 약속 잡기", "사람과 만날 날짜 하나를 정해봐요."),
  m("S_FIN_NEXT", "다음 목표 한 줄 쓰기", "일이든 공부든 하고 싶은 것 하나면 충분해요."),
]

const TYPE_POOLS: Record<TypeCode, PoolMission[][]> = {
  INDEPENDENT_LOW_INCOME: INDEPENDENT,
  HEALTH_EMOTION: HEALTH,
  FAMILY_LIVING: FAMILY,
}

// ─────────────────────────────────────────────────────────────────────
// 배치
// ─────────────────────────────────────────────────────────────────────

/**
 * 한 구간(10단계 = 30슬롯)에 새 미션 12개를 어떻게 나누는가.
 * 구간의 첫 두 단계는 새 미션 2개, 나머지 여덟 단계는 1개.
 *   2 + 2 + 1×8 = 12 ✓  (공용 9 + 유형별 3)
 */
function newCountFor(stageInBand: number, band: number): number {
  // 10구간은 100단계를 졸업 미션에 내주므로 9단계 안에 12개를 다 소개해야 한다.
  // 앞 세 단계가 2개씩 → 2+2+2+1×6 = 12 ✓ (다른 구간은 2+2+1×8 = 12 ✓)
  const doubleUntil = band === BAND_COUNT ? 3 : 2
  return stageInBand <= doubleUntil ? 2 : 1
}

/**
 * 구간의 새 미션 12개를 순서대로 늘어놓는다.
 * 공용을 먼저 두고 유형별을 뒤에 두면 유형 고유 미션이 전부 구간 끝에 몰린다.
 * 3개씩 끼워 넣어 구간 안에 흩뿌린다 — 4번째마다 유형 미션이 하나 온다.
 */
function bandIntroOrder(band: number, typeCode: TypeCode): PoolMission[] {
  const shared = SHARED[band - 1]
  const typed = TYPE_POOLS[typeCode][band - 1]
  const out: PoolMission[] = []
  let s = 0
  let t = 0
  for (let i = 0; i < shared.length + typed.length; i++) {
    // 0,1,2 공용 → 3 유형 → 4,5,6 공용 → 7 유형 → ...
    const takeTyped = i % 4 === 3 && t < typed.length
    if (takeTyped) out.push(typed[t++])
    else if (s < shared.length) out.push(shared[s++])
    else out.push(typed[t++])
  }
  return out
}

type Placement = { stage: number; slot: number; mission: PoolMission }

/**
 * 유형 하나의 100단계 배치를 계산한다. 무작위를 쓰지 않는다.
 *
 * 각 단계의 슬롯 채우는 순서
 *   1. 새 미션 (구간별 1~2개)
 *   2. 최근 복습 — 직전 3단계에 처음 나온 미션 중 가장 오래 안 한 것
 *   3. 다지기 복습 — 지금까지 나온 전부에서 가장 오래 안 한 것(LRU)
 *
 * 1단계는 아직 복습할 것이 없다. 그때는 그 구간의 새 미션을 더 당겨 쓴다 —
 * 그러면 뒤 단계에 새 미션이 부족해지므로, 부족분은 LRU가 메운다.
 */
export function planCurriculum(typeCode: TypeCode): Placement[] {
  const placements: Placement[] = []

  /** key → 마지막으로 배치된 단계. 복습 대상을 고를 때 이 값이 가장 작은 것을 쓴다 */
  const lastSeen = new Map<string, number>()
  /** key → 처음 나온 단계 */
  const introducedAt = new Map<string, number>()
  const byKey = new Map<string, PoolMission>()

  // 구간별 새 미션 대기열
  const queues: PoolMission[][] = []
  for (let band = 1; band <= BAND_COUNT; band++) {
    queues.push(bandIntroOrder(band, typeCode))
  }

  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    // 마지막 단계는 졸업 미션 3개로 고정한다. 복습을 섞지 않는다
    if (stage === TOTAL_STAGES) {
      FINALE.forEach((mm, i) => {
        byKey.set(mm.key, mm)
        introducedAt.set(mm.key, stage)
        lastSeen.set(mm.key, stage)
        placements.push({ stage, slot: i + 1, mission: mm })
      })
      continue
    }

    const band = bandOf(stage)
    const stageInBand = ((stage - 1) % STAGES_PER_BAND) + 1
    const chosen: PoolMission[] = []

    // ── 1. 새 미션
    let wantNew = newCountFor(stageInBand, band)
    // 1단계는 복습할 것이 없으므로 3칸을 다 새 미션으로 채운다
    if (stage === 1) wantNew = MISSIONS_PER_STAGE

    const queue = queues[band - 1]
    while (wantNew > 0 && queue.length > 0) {
      const next = queue.shift()!
      chosen.push(next)
      introducedAt.set(next.key, stage)
      byKey.set(next.key, next)
      wantNew--
    }

    // ── 2·3. 복습
    const pickReview = (candidates: PoolMission[]): PoolMission | null => {
      const used = new Set(chosen.map((c) => c.key))
      let best: PoolMission | null = null
      let bestSeen = Number.POSITIVE_INFINITY
      for (const c of candidates) {
        if (used.has(c.key)) continue
        const seen = lastSeen.get(c.key) ?? 0
        // 같은 값이면 먼저 나온 것을 고른다 — 순서가 유형·실행에 따라 흔들리지 않게
        if (seen < bestSeen) {
          best = c
          bestSeen = seen
        }
      }
      return best
    }

    const allIntroduced = [...byKey.values()]

    while (chosen.length < MISSIONS_PER_STAGE) {
      const remaining = MISSIONS_PER_STAGE - chosen.length

      // 최근 복습: 직전 3단계에 처음 나온 것. 짧은 간격 재노출로 습관을 붙인다
      let picked: PoolMission | null = null
      if (remaining === 2 || chosen.length === MISSIONS_PER_STAGE - 2) {
        const recent = allIntroduced.filter((mm) => {
          const at = introducedAt.get(mm.key) ?? 0
          return at >= stage - 3 && at < stage
        })
        picked = pickReview(recent)
      }

      // 다지기 복습: 전체 LRU. 1구간 미션도 90단계에서 다시 돌아온다
      if (!picked) picked = pickReview(allIntroduced)

      // 후보가 정말 없을 때(1단계 등)는 다음 구간 대기열에서 당겨 쓴다
      if (!picked) {
        const donor = queues.slice(band).find((q) => q.length > 0) ?? queues[band - 1]
        const next = donor.shift()
        if (!next) break // 풀이 완전히 비었다. 슬롯이 3개 미만인 단계가 생긴다
        picked = next
        introducedAt.set(next.key, stage)
        byKey.set(next.key, next)
      }

      chosen.push(picked)
    }

    chosen.forEach((mm, i) => {
      lastSeen.set(mm.key, stage)
      placements.push({ stage, slot: i + 1, mission: mm })
    })
  }

  return placements
}

/**
 * 배치를 Mission 행으로 바꾼다.
 *
 * code 규칙은 기존과 같다: {유형}_S{단계}_{슬롯}.
 * 같은 미션이 여러 단계에 놓이므로 code에 미션 키를 쓰지 않는다 —
 * 재등장분이 서로 다른 행이어야 UserMission 유니크 제약(userId+missionId+"STAGE")이
 * 두 번째 완료를 막지 않는다. 이게 반복 미션이 성립하는 이유다.
 */
export function buildStageMissions(typeCode: TypeCode): Prisma.MissionCreateInput[] {
  return planCurriculum(typeCode).map(({ stage, slot, mission }) => {
    const reward = rewardForStage(stage)
    return {
      code: `${typeCode}_S${stage}_${slot}`,
      scope: "STAGE" as const,
      typeCode,
      stage,
      title: mission.title,
      description: mission.desc,
      rewardSeeds: reward.seeds,
      rewardShards: reward.shards,
      // 친밀도는 0. 이유는 lib/missions/bands.ts rewardForStage 주석에 있다
      rewardAffinity: 0,
      requiresPhoto: mission.photo === true,
      order: slot,
    }
  })
}

/** 문구를 고쳤을 때 중복 키·개수 오류를 잡는 자기 점검. npm run check:curriculum */
export function auditCurriculum() {
  const problems: string[] = []

  for (let band = 1; band <= BAND_COUNT; band++) {
    if (SHARED[band - 1]?.length !== 9) {
      problems.push(`공용 구간 ${band}: 9개여야 하는데 ${SHARED[band - 1]?.length}개`)
    }
  }

  const seen = new Set<string>()
  for (const pool of [SHARED, [FINALE], ...Object.values(TYPE_POOLS)]) {
    for (const band of pool) {
      for (const mm of band) {
        if (seen.has(mm.key)) problems.push(`키 중복: ${mm.key}`)
        seen.add(mm.key)
      }
    }
  }

  const stats: Record<string, unknown> = {}
  for (const typeCode of Object.keys(TYPE_POOLS) as TypeCode[]) {
    if (TYPE_POOLS[typeCode].length !== BAND_COUNT) {
      problems.push(`${typeCode}: 구간이 ${TYPE_POOLS[typeCode].length}개`)
    }
    for (let band = 1; band <= BAND_COUNT; band++) {
      if (TYPE_POOLS[typeCode][band - 1]?.length !== 3) {
        problems.push(`${typeCode} 구간 ${band}: 3개여야 하는데 ${TYPE_POOLS[typeCode][band - 1]?.length}개`)
      }
    }

    const plan = planCurriculum(typeCode)
    const counts = new Map<string, number>()
    for (const p of plan) counts.set(p.mission.key, (counts.get(p.mission.key) ?? 0) + 1)

    // 모든 단계가 3슬롯인지
    const perStage = new Map<number, number>()
    for (const p of plan) perStage.set(p.stage, (perStage.get(p.stage) ?? 0) + 1)
    for (let s = 1; s <= TOTAL_STAGES; s++) {
      if (perStage.get(s) !== MISSIONS_PER_STAGE) {
        problems.push(`${typeCode} 단계 ${s}: 미션 ${perStage.get(s) ?? 0}개`)
      }
    }

    // 같은 단계에 같은 미션이 두 번 오지 않는지
    for (let s = 1; s <= TOTAL_STAGES; s++) {
      const keys = plan.filter((p) => p.stage === s).map((p) => p.mission.key)
      if (new Set(keys).size !== keys.length) problems.push(`${typeCode} 단계 ${s}: 같은 미션 중복`)
    }

    // 풀에 써놓고 한 번도 배치되지 않은 미션이 없는지. 있으면 문구를 쓴 만큼 낭비다
    const expected = [
      ...SHARED.flat().map((mm) => mm.key),
      ...TYPE_POOLS[typeCode].flat().map((mm) => mm.key),
      ...FINALE.map((mm) => mm.key),
    ]
    for (const key of expected) {
      if (!counts.has(key)) problems.push(`${typeCode}: ${key}가 어느 단계에도 배치되지 않았다`)
    }

    const exposures = [...counts.values()]
    stats[typeCode] = {
      슬롯: plan.length,
      고유미션: counts.size,
      평균등장: (plan.length / counts.size).toFixed(2),
      최소등장: Math.min(...exposures),
      최대등장: Math.max(...exposures),
      사진미션슬롯: plan.filter((p) => p.mission.photo).length,
    }
  }

  return { problems, stats }
}
