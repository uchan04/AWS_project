/**
 * 로컬 테스트용. 공용 테스트 계정의 친밀도를 정한 값으로 맞춘다.
 *
 *   npx tsx -r dotenv/config scripts/set-affinity.ts 2000
 *
 * **`calculateReward()`를 통과하지 않는다.** 그 함수는 획득 배율이고 이것은 시연용
 * 값 맞추기다 — 지급 경로가 아니다(`CLAUDE.md` 2절의 규칙은 서비스 코드에 걸린 것이다).
 *
 * **`test@welli.local` 한 행만 본다.** 공유 개발 DB이므로 대상을 이메일로 못 박는다.
 * 이 계정은 심사 전 삭제 대상이다(`scripts/list-test-rows.ts`).
 */
import { PrismaClient } from "@prisma/client"

const EMAIL = "test@welli.local"

const prisma = new PrismaClient()

async function main() {
  const want = Number(process.argv[2] ?? 2000)
  if (!Number.isFinite(want) || want < 0) throw new Error("친밀도는 0 이상 숫자로 준다")

  const before = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, affinity: true },
  })
  if (!before) throw new Error(`${EMAIL} 계정이 없다`)

  const after = await prisma.user.update({
    where: { id: before.id },
    data: { affinity: Math.floor(want) },
    select: { affinity: true },
  })
  console.log(`${EMAIL}`)
  console.log(`  친밀도 ${before.affinity} -> ${after.affinity}`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
