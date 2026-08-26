/**
 * 심사·배포 전에 지워야 하는 테스트 행을 센다. `npx tsx -r dotenv/config scripts/list-test-rows.ts`
 *
 * 공용 테스트 계정과 e2e 계정이 공유 개발 DB에 쌓인다. **읽기 전용이다** —
 * 지우는 것은 사람이 판단한다(공유 DB이고, 어느 행이 남의 것인지 여기서 알 수 없다).
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "welli.local" } },
        { email: { startsWith: "egg-" } },
        { email: { startsWith: "e2e-" } },
      ],
    },
    select: { email: true, createdAt: true, typeCode: true },
    orderBy: { createdAt: "asc" },
  })
  const total = await prisma.user.count()
  console.log(`전체 User ${total}행 중 테스트 행 ${rows.length}행`)
  for (const r of rows) {
    console.log(`  ${r.createdAt.toISOString().slice(0, 16)}  ${r.email}  ${r.typeCode ?? "-"}`)
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
