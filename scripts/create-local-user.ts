import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../lib/password"

// npx tsx scripts/create-local-user.ts
//
// 팀 공용 테스트 계정을 공유 RDS에 만든다. 이미 있으면 비밀번호만 다시 맞춘다.
// 계정 정보를 여기 그대로 적어 둔 것은 5인이 같은 계정으로 화면을 확인해야 하기 때문이다.
// 이 비밀번호는 비밀이 아니다 — 다른 어디에도 쓰지 않고, 심사·배포 전에 이 계정을 지운다.
// (docs/dev/diagnosis.md "팀 공용 테스트 계정" 절에도 같은 내용이 적혀 있다)

const EMAIL = "test@welli.local"
const PASSWORD = "welli-test-1234"

// 자체 계정은 cognitoSub에 "local:" 접두사를 쓴다(Cognito sub는 UUID라 겹치지 않는다).
// 공용 계정은 매번 같은 행을 쓰도록 고정값을 준다.
const COGNITO_SUB = "local:team-test"

async function main() {
  const prisma = new PrismaClient()
  try {
    const user = await prisma.user.upsert({
      where: { cognitoSub: COGNITO_SUB },
      update: { email: EMAIL, passwordHash: hashPassword(PASSWORD) },
      create: { cognitoSub: COGNITO_SUB, email: EMAIL, passwordHash: hashPassword(PASSWORD) },
    })
    console.log(`계정 준비 완료: ${EMAIL} / 진단 ${user.typeCode ? "완료" : "미진단"}`)
  } finally {
    await prisma.$disconnect()
  }
}

main()
