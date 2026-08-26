/**
 * 로컬 테스트용. 공용 테스트 계정의 진행 중인 펫 외출 복귀 시각을 옮긴다.
 *
 *   npx tsx -r dotenv/config scripts/set-outing-return.ts        # 지금 복귀 (결과 확인 버튼)
 *   npx tsx -r dotenv/config scripts/set-outing-return.ts 2      # 2분 뒤 복귀
 *
 * 외출은 4시간이라 화면을 확인할 때마다 기다릴 수 없다. `returnsAt`만 옮긴다 —
 * 재화·친밀도·legs는 건드리지 않으므로 이후 "결과 확인"이 정상 경로로 흐른다.
 *
 * **`test@welli.local` 한 행만 본다.** 공유 개발 DB이므로 대상을 이메일로 못 박는다
 * (CLAUDE.md 밖 규칙: 공유 DB는 손대지 않는다. 이 계정은 심사 전 삭제 대상 테스트 행이다).
 */
import { PrismaClient } from "@prisma/client"

const EMAIL = "test@welli.local"

const prisma = new PrismaClient()

async function main() {
  const minutes = Number(process.argv[2] ?? 0)
  if (!Number.isFinite(minutes)) throw new Error("분은 숫자로 준다")

  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } })
  if (!user) throw new Error(`${EMAIL} 계정이 없다`)

  const outing = await prisma.petOuting.findFirst({
    where: { userId: user.id, claimedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, returnsAt: true },
  })
  if (!outing) {
    console.log("진행 중인 외출이 없다 — 화면에서 먼저 외출을 보낸다")
    return
  }

  const returnsAt = new Date(Date.now() + minutes * 60_000)
  await prisma.petOuting.update({ where: { id: outing.id }, data: { returnsAt } })
  console.log(`외출 ${outing.id}`)
  console.log(`  returnsAt ${outing.returnsAt.toISOString()} -> ${returnsAt.toISOString()}`)
  console.log(minutes <= 0 ? "  이제 화면에 결과 확인 버튼이 뜬다" : `  ${minutes}분 뒤에 뜬다`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
