// 임시. 진행 중인(claimedAt IS NULL) 외출 1건을 **취소**한다 — 행을 지우고 차감된
// 친밀도 200을 되돌린다. 사용자 요청("외출 취소하고")으로 만든 개발용 스크립트다.
//
// **친밀도를 calculateReward() 없이 직접 올린다.** 이건 새 코드 경로가 아니라 lib/outing.ts가
// 이미 하는 일의 정확한 역연산이다 — 그 파일 주석이 "친밀도 차감은 calculateReward()를
// 통과하지 않는다(그 함수는 획득 배율이라 지출에 걸면 효과 스킨 유저가 더 비싸게 낸다)"고
// 적어 뒀고, 그래서 차감이 정확히 OUTING_COST_AFFINITY다. 환불도 같은 값이어야 한다.
// calculateReward()에 넣으면 배율이 얹혀 **낸 것보다 많이 돌려준다.**
//
// 삭제와 환불을 한 트랜잭션에 묶는다 — 둘 중 하나만 되면 친밀도가 사라지거나 두 번 생긴다.
import { OUTING_COST_AFFINITY } from "../lib/pet"
import { prisma } from "../lib/prisma"

async function main() {
  const email = process.argv[2] ?? null

  const row = await prisma.petOuting.findFirst({
    where: {
      claimedAt: null,
      ...(email ? { user: { email } } : {}),
    },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      returnsAt: true,
      user: { select: { id: true, email: true, affinity: true } },
    },
  })

  if (!row) {
    console.log("진행 중인 외출이 없다. 취소할 것이 없음")
    return
  }

  console.log("취소 대상:", {
    id: row.id,
    email: row.user.email,
    친밀도_전: row.user.affinity,
    startedAt: row.startedAt.toISOString(),
    returnsAt: row.returnsAt.toISOString(),
  })

  const after = await prisma.$transaction(async (tx) => {
    // 지우기 전에 그 행이 아직 미수령인지 다시 본다 — 그 사이에 사용자가 수령했으면
    // 보상이 이미 지급됐으므로 환불하면 이중 지급이 된다
    const gone = await tx.petOuting.deleteMany({ where: { id: row.id, claimedAt: null } })
    if (gone.count === 0) return null
    return tx.user.update({
      where: { id: row.user.id },
      data: { affinity: { increment: OUTING_COST_AFFINITY } },
      select: { affinity: true },
    })
  })

  if (!after) {
    console.log("그 사이에 수령됐다. 아무것도 하지 않았다")
    return
  }

  console.log("취소 완료:", { 친밀도_후: after.affinity, 환불: OUTING_COST_AFFINITY })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
