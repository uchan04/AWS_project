import { PrismaClient } from "@prisma/client"
import { seedItems } from "./seed/items"
import { seedMissions } from "./seed/missions"

// 소유자: E. 엔트리만 담당한다. 내용은 seed/ 안의 각 파일에서 채운다.
// 실행: npm run db:seed

const prisma = new PrismaClient()

async function main() {
  await seedItems(prisma)
  await seedMissions(prisma)
  console.log("seed 완료")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
