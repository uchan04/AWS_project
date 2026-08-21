import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { cognitoSub: "local:team-test" },
    update: { typeCode: "INDEPENDENT_LOW_INCOME", nickname: "Welli 팀" },
    create: { cognitoSub: "local:team-test", typeCode: "INDEPENDENT_LOW_INCOME", nickname: "Welli 팀" },
  })
  console.log("User updated:", user)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
