import { PrismaClient } from "@prisma/client"
import { MISSIONS_PER_STAGE } from "@/lib/missions/bands"

// 소유자: A. 2026-08-22 진단용 조회 스크립트. **아무것도 쓰지 않는다.**
//
// 옛 시드는 단계당 미션 4개(slot 1~4)를 만들었다. 100단계 커리큘럼은 3개다
// (lib/missions/bands.ts MISSIONS_PER_STAGE). 그래서 옛 slot 4 행 9개가
// 갱신되지 않고 남아 단계 1~3에 미션이 4개로 보인다.
//
// 2026-08-24: 삭제 경로를 걷어냈다. 공유 개발 DB는 5인이 같이 쓰므로 손대지 않기로 했고
// (docs/dev/missions.md), 이 행들은 이미 **코드에서 배제**된다 — 조회 3곳
// (catalog.ts·dashboard.ts·stages.ts)과 완료 경로가 order <= MISSIONS_PER_STAGE로 거른다.
// 그러니 남길 값이 있는 것은 "지금 몇 행이 남아 있나"를 보는 것뿐이고, --apply는
// 되돌릴 수 없는 팀 데이터 삭제라 코드에 남겨 둘 이유가 없다.

const prisma = new PrismaClient()

async function main() {
  const orphans = await prisma.mission.findMany({
    where: { scope: "STAGE", order: { gt: MISSIONS_PER_STAGE } },
    select: { code: true, title: true, _count: { select: { userMissions: true } } },
  })

  console.log(`커리큘럼 밖 슬롯(order > ${MISSIONS_PER_STAGE}) ${orphans.length}개`)
  for (const o of orphans) {
    console.log(`  ${o.code}  "${o.title}"  완료기록 ${o._count.userMissions}건`)
  }
  if (orphans.length > 0) {
    console.log("\n지우지 않는다. 화면·완료 경로가 이미 배제한다 — docs/dev/missions.md 참고")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
