import type { Prisma, PrismaClient, TypeCode } from "@prisma/client"
import { buildStageMissions } from "./curriculum"

const TYPE_CODES: TypeCode[] = ["INDEPENDENT_LOW_INCOME", "HEALTH_EMOTION", "FAMILY_LIVING"]

// 소유자: A. 미션 콘텐츠 — 공용 일일 5개 + 단계 미션 900개(유형당 100단계 × 3).
//
// 2026-08-22: 단계를 3개 → 100개로 늘렸다. 단계 미션 본문은 여기 없다 —
// prisma/seed/curriculum.ts가 고유 미션 180개를 굴려 유형당 300슬롯을 만든다.
// 난이도 순서·보상 공식·구간 이름은 lib/missions/bands.ts에 있다.
//
// code 규칙은 그대로다: DAILY_*, {유형}_S{단계}_{슬롯}.
// 옛 3단계 콘텐츠와 code가 겹치므로 기존 행은 새 문구로 덮어써진다 —
// 이미 완료한 UserMission 행은 그 미션 id를 계속 가리키므로 마이그레이션이 필요 없다.

// 홈 화면의 "오늘의 미션 미리보기"가 이 배열을 그대로 읽는다(app/page.tsx).
// 문구를 두 곳에 복사하지 않기 위해 export한다. 런타임 import는 타입뿐이라 클라이언트에서도 안전하다
export const DAILY: Prisma.MissionCreateInput[] = [
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
    // 친밀도는 미션 보상이 아니라 D의 app/community/_lib/affinity.ts가 준다(POST_AFFINITY = 20).
    // 양쪽이 각각 20을 주면 글 1개에 40이 들어간다. 확정값은 20이므로 이쪽을 0으로 둔다
    // (2026-08-20 결정). 지급 지점을 커뮤니티 쪽에 둔 이유는 글을 두 번째로 쓸 때도
    // 친밀도가 붙어야 하는데, 미션 보상은 하루 한 번만 나가기 때문이다.
    rewardAffinity: 0,
    order: 4,
  },
  {
    code: "DAILY_CHAT",
    scope: "DAILY",
    title: "AI 친구와 대화하기",
    description: "무슨 말이든 괜찮아요. 한 마디만 걸어봐요.",
    rewardSeeds: 15,
    // 위와 같은 이유. 대화 친밀도는 D의 CHAT_TURN_AFFINITY = 5가 턴마다 준다
    rewardAffinity: 0,
    order: 5,
  },
]

export async function seedMissions(prisma: PrismaClient) {
  for (const mission of DAILY) {
    await prisma.mission.upsert({
      where: { code: mission.code },
      update: mission,
      create: mission,
    })
  }

  const stageRows = TYPE_CODES.flatMap((typeCode) => buildStageMissions(typeCode))

  // upsert를 900번 돌리면 RDS 왕복(us-east-1, 176ms)만 2분 40초다.
  // 이미 있는 code를 한 번에 읽고, 새 행은 createMany 한 번으로, 바뀐 행만 update한다
  const existing = await prisma.mission.findMany({
    where: { code: { in: stageRows.map((r) => r.code) } },
  })
  const byCode = new Map(existing.map((e) => [e.code, e]))

  const toCreate = stageRows.filter((r) => !byCode.has(r.code))
  if (toCreate.length > 0) {
    await prisma.mission.createMany({ data: toCreate })
  }

  let updated = 0
  for (const row of stageRows) {
    const prev = byCode.get(row.code)
    if (!prev) continue
    const changed =
      prev.title !== row.title ||
      prev.description !== row.description ||
      prev.rewardSeeds !== row.rewardSeeds ||
      prev.rewardShards !== row.rewardShards ||
      prev.requiresPhoto !== row.requiresPhoto ||
      prev.stage !== row.stage ||
      prev.order !== row.order
    if (!changed) continue
    await prisma.mission.update({ where: { code: row.code }, data: row })
    updated++
  }

  console.log(
    `미션 반영 — 일일 ${DAILY.length}개, 단계 ${stageRows.length}개(신규 ${toCreate.length} / 갱신 ${updated})`,
  )
}
