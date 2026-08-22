import { PrismaClient } from "@prisma/client"

// 소유자: A. 2026-08-22 일회성 정리 스크립트.
//
// 옛 시드는 단계당 미션 4개(slot 1~4)를 만들었다. 100단계 커리큘럼은 3개다
// (lib/missions/bands.ts MISSIONS_PER_STAGE). 그래서 옛 slot 4 행 9개가
// 갱신되지 않고 남아 단계 1~3에 미션이 4개로 보였다.
//
// --apply 없이 돌리면 무엇을 지울지만 출력한다.

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

async function main() {
  const orphans = await prisma.mission.findMany({
    where: { scope: "STAGE", order: { gt: 3 } },
    select: { id: true, code: true, title: true, _count: { select: { userMissions: true } } },
  })

  console.log(`옛 slot 4 행 ${orphans.length}개`)
  for (const o of orphans) {
    console.log(`  ${o.code}  "${o.title}"  완료기록 ${o._count.userMissions}건`)
  }

  if (orphans.length === 0) return
  if (!APPLY) {
    console.log("\n--apply를 붙이면 완료기록과 함께 지운다")
    return
  }

  const ids = orphans.map((o) => o.id)
  // UserMission이 Mission을 FK로 잡고 있어 완료기록을 먼저 지워야 한다.
  // 잃는 것은 "삭제된 미션을 완료했다"는 기록뿐이다 — 이미 지급된 씨앗은 User에 남는다
  const removed = await prisma.userMission.deleteMany({ where: { missionId: { in: ids } } })
  await prisma.mission.deleteMany({ where: { id: { in: ids } } })
  console.log(`\n미션 ${ids.length}개, 완료기록 ${removed.count}건 삭제`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
