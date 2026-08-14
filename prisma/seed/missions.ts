import type { Prisma, PrismaClient } from "@prisma/client"

// 소유자: A. 미션 콘텐츠 41개 (공용 일일 5 + 유형당 12 × 3). 8/15까지 완성.
//
// 단계 설계 (SPEC.md 4절)
//   1단계: 집 안에서 할 수 있는 것
//   2단계: 집 주변으로 나가는 것
//   3단계: 사람과 접촉하는 것 (사진 미션은 여기에만 배치)
//
// code는 유니크해야 한다. 규칙: DAILY_*, {유형}_S{단계}_{번호}

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

// TODO(A): 유형당 12개씩 총 36개. 아래는 형식 예시 1개다.
const STAGE: Prisma.MissionCreateInput[] = [
  {
    code: "HEALTH_EMOTION_S1_1",
    scope: "STAGE",
    typeCode: "HEALTH_EMOTION",
    stage: 1,
    title: "이불 정리하기",
    description: "일어난 자리를 손으로 한 번만 펴줘요.",
    rewardSeeds: 20,
    order: 1,
  },
]

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
