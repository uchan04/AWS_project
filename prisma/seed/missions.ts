import type { Prisma, PrismaClient, TypeCode } from "@prisma/client"

// 소유자: A. 미션 콘텐츠 41개 (공용 일일 5 + 유형당 12 × 3).
//
// 단계 설계 (SPEC.md 4절)
//   1단계: 집 안에서 할 수 있는 것
//   2단계: 집 주변으로 나가는 것
//   3단계: 사람과 접촉하는 것 (사진 미션은 여기에만 배치)
//
// code는 유니크해야 한다. 규칙: DAILY_*, {유형}_S{단계}_{번호}
// 보상과 사진 미션 배치는 stageMission()이 강제한다. 개별 미션에서 값을 덮어쓰지 않는다.

const DAILY: Prisma.MissionCreateInput[] = [
  {
    code: "DAILY_CURTAIN",
    scope: "DAILY",
    title: "커튼 열고 햇빛 보기",
    description: "창문 커튼을 열고 1분만 바깥을 바라봐요.",
    rewardSeeds: 10,
    order: 1,
  },
  {
    code: "DAILY_WATER",
    scope: "DAILY",
    title: "물 한 잔 마시기",
    description: "지금 물 한 잔을 마셔요.",
    rewardSeeds: 10,
    order: 2,
  },
  {
    code: "DAILY_STRETCH",
    scope: "DAILY",
    title: "기지개 켜기",
    description: "자리에서 팔을 위로 뻗고 크게 기지개를 켜요.",
    rewardSeeds: 10,
    order: 3,
  },
  {
    code: "DAILY_COMMUNITY_POST",
    scope: "DAILY",
    title: "커뮤니티에 글 남기기",
    description: "오늘의 기분을 한 줄이라도 남겨봐요. 주제를 추천해 드려요.",
    rewardSeeds: 15,
    rewardAffinity: 20,
    order: 4,
  },
  {
    code: "DAILY_CHAT",
    scope: "DAILY",
    title: "AI 친구와 대화하기",
    description: "무슨 말이든 괜찮아요. 한 마디만 걸어봐요.",
    rewardSeeds: 15,
    rewardAffinity: 5,
    order: 5,
  },
]

// 단계별 고정 보상 (docs/dev/diagnosis.md 7장)
const SEEDS_BY_STAGE = { 1: 20, 2: 35, 3: 60 } as const

/**
 * 단계 미션 한 개를 만든다.
 * 3단계는 별조각 5를 함께 주고, 3단계의 3·4번은 사진 업로드 미션이다.
 */
function stageMission(
  typeCode: TypeCode,
  stage: 1 | 2 | 3,
  order: number,
  title: string,
  description: string,
): Prisma.MissionCreateInput {
  return {
    code: `${typeCode}_S${stage}_${order}`,
    scope: "STAGE",
    typeCode,
    stage,
    title,
    description,
    rewardSeeds: SEEDS_BY_STAGE[stage],
    rewardShards: stage === 3 ? 5 : 0,
    requiresPhoto: stage === 3 && order >= 3,
    order,
  }
}

// 독립거주-저소득형 (여우) — 1인 가구 92%, 저소득 87%, 부채 31%
// 혼자 사는 생활 관리가 중심이다. 돈을 쓰게 만드는 미션을 두지 않는다.
const INDEPENDENT = [
  stageMission("INDEPENDENT_LOW_INCOME", 1, 1, "창문 열고 환기하기", "창문을 열어 5분만 공기를 바꿔봐요."),
  stageMission("INDEPENDENT_LOW_INCOME", 1, 2, "그릇 하나 씻기", "쌓인 그릇 중 하나만 씻어봐요."),
  stageMission("INDEPENDENT_LOW_INCOME", 1, 3, "냉장고 열어보기", "지금 뭐가 있는지 한 번만 확인해봐요."),
  stageMission("INDEPENDENT_LOW_INCOME", 1, 4, "오늘 쓴 돈 적기", "금액만 적어도 충분해요. 안 썼다면 0원이라고 적어도 좋아요."),
  stageMission("INDEPENDENT_LOW_INCOME", 2, 1, "현관 밖에 1분", "문을 열고 1분만 서 있어봐요."),
  stageMission("INDEPENDENT_LOW_INCOME", 2, 2, "우편함 확인하기", "쌓인 우편물을 한 번만 확인해봐요."),
  stageMission("INDEPENDENT_LOW_INCOME", 2, 3, "동네 한 바퀴", "천천히 걸어도 좋아요. 10분만 걸어봐요."),
  stageMission("INDEPENDENT_LOW_INCOME", 2, 4, "가게 둘러보기", "사지 않아도 괜찮아요. 둘러만 봐도 충분해요."),
  stageMission("INDEPENDENT_LOW_INCOME", 3, 1, "계산할 때 인사", "'감사합니다' 한마디만 해봐요."),
  stageMission("INDEPENDENT_LOW_INCOME", 3, 2, "도서관 들러보기", "도서관이나 주민센터에 들어가만 봐도 충분해요."),
  stageMission("INDEPENDENT_LOW_INCOME", 3, 3, "편의점에서 하나 사기", "가장 싼 것 하나여도 좋아요. 사진으로 남겨봐요."),
  stageMission("INDEPENDENT_LOW_INCOME", 3, 4, "밖에 30분 앉아있기", "공원 벤치나 도서관 자리에 앉아 있던 자리를 찍어봐요."),
]

// 건강·정서취약형 (고양이) — 우울 57%, 소진 85%, 미취업 54%, 의료 미충족·활동 제약 높음
// 세 유형 중 강도를 가장 낮게 잡는다. 몸과 기분 회복이 먼저다.
const HEALTH = [
  stageMission("HEALTH_EMOTION", 1, 1, "이불 정리하기", "일어난 자리를 손으로 한 번만 펴줘요."),
  stageMission("HEALTH_EMOTION", 1, 2, "따뜻한 물 마시기", "미지근한 물이라도 한 잔 마셔봐요."),
  stageMission("HEALTH_EMOTION", 1, 3, "기분 한 단어로 적기", "좋다, 별로다, 모르겠다 중 하나여도 괜찮아요."),
  stageMission("HEALTH_EMOTION", 1, 4, "5분 숨 고르기", "눈을 감고 천천히 숨만 쉬어봐요."),
  stageMission("HEALTH_EMOTION", 2, 1, "현관에서 숨 세 번", "문을 열고 숨 세 번만 쉬어봐요."),
  stageMission("HEALTH_EMOTION", 2, 2, "복도까지 걸어보기", "집 앞 복도만 왕복해도 충분해요."),
  stageMission("HEALTH_EMOTION", 2, 3, "밖에서 10분", "그늘이라도 좋아요. 밖에 10분만 있어봐요."),
  stageMission("HEALTH_EMOTION", 2, 4, "병원 위치 찾아보기", "가까운 병원이나 상담 센터 위치만 검색해봐요. 예약하지 않아도 괜찮아요."),
  stageMission("HEALTH_EMOTION", 3, 1, "안부 한 줄 보내기", "'잘 지내?' 한마디만 보내봐요."),
  stageMission("HEALTH_EMOTION", 3, 2, "3분 통화하기", "말하기 어려우면 듣기만 해도 괜찮아요."),
  stageMission("HEALTH_EMOTION", 3, 3, "밖에서 한 잔 마시기", "밖에서 마신 컵을 찍어봐요. 물이어도 좋아요."),
  stageMission("HEALTH_EMOTION", 3, 4, "사람 있는 곳에 앉기", "공원이나 가게에 앉은 자리를 찍어봐요."),
]

// 가족동거형 (곰) — 가족 동거, 건강 취약성은 낮지만 미취업 43%
// 집 안에 이미 사람이 있으므로 1단계부터 가족과의 접촉을 소재로 쓴다.
const FAMILY = [
  stageMission("FAMILY_LIVING", 1, 1, "가족에게 인사하기", "'잘 잤어' 한마디만 해봐요."),
  stageMission("FAMILY_LIVING", 1, 2, "방문 열어두기", "10분만 열어두어도 괜찮아요."),
  stageMission("FAMILY_LIVING", 1, 3, "같이 한 끼 먹기", "한 자리에 앉아만 있어도 충분해요."),
  stageMission("FAMILY_LIVING", 1, 4, "집안일 하나 돕기", "설거지나 분리수거 한 가지만 해봐요."),
  stageMission("FAMILY_LIVING", 2, 1, "심부름 하나 하기", "가까운 곳 하나만 다녀와봐요."),
  stageMission("FAMILY_LIVING", 2, 2, "같이 산책하기", "말 없이 걸어도 좋아요."),
  stageMission("FAMILY_LIVING", 2, 3, "혼자 10분 걷기", "집 근처만 돌아도 충분해요."),
  stageMission("FAMILY_LIVING", 2, 4, "장보기 따라가기", "따라만 가도 괜찮아요."),
  stageMission("FAMILY_LIVING", 3, 1, "가게에서 말해보기", "'이거 주세요' 한마디만 해봐요."),
  stageMission("FAMILY_LIVING", 3, 2, "동네 활동 찾아보기", "동네 프로그램이나 모임을 검색만 해봐요."),
  stageMission("FAMILY_LIVING", 3, 3, "가족과 밖에 나가기", "함께 나간 자리를 사진으로 남겨봐요."),
  stageMission("FAMILY_LIVING", 3, 4, "혼자 다녀오기", "혼자 다녀온 곳을 한 장 찍어봐요."),
]

const STAGE = [...INDEPENDENT, ...HEALTH, ...FAMILY]

export async function seedMissions(prisma: PrismaClient) {
  for (const mission of [...DAILY, ...STAGE]) {
    await prisma.mission.upsert({
      where: { code: mission.code },
      update: mission,
      create: mission,
    })
  }
  console.log(`미션 ${DAILY.length + STAGE.length}개 반영`)
}
