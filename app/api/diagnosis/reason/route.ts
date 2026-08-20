// 소유자: A. 결과 화면의 판정 근거 3줄.
//
// 진단 완료 API에서 같이 만들지 않는다. Bedrock 왕복이 완료 응답에 붙으면 결과 화면 진입이
// 그만큼 늦어지고, Bedrock이 죽은 날에는 진단 자체가 실패한다. 화면이 뜬 뒤에 따로 읽는다.
//
// 한 번 만든 문장은 DiagnosisSession.reasonText에 저장하고 다음부터 그것을 돌려준다.
// 새로고침마다 다시 부르면 값도 매번 달라지고 호출 비용도 계속 든다.

import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { fail, ok } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import type { Answer } from "@/lib/diagnosis/indicators"
import { summarizeReason } from "@/lib/diagnosis/reason"

export async function GET() {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }

  // 재진단이 있으면 가장 최근 것만 본다
  const session = await prisma.diagnosisSession.findFirst({
    where: { userId: user.id },
    orderBy: { completedAt: "desc" },
    select: { id: true, answers: true, typeCode: true, reasonText: true },
  })

  if (!session) return ok(null)

  if (session.reasonText) {
    return ok({ lines: session.reasonText.split("\n") })
  }

  let lines: string[]
  try {
    lines = await summarizeReason({ answers: session.answers as unknown as Answer[], typeCode: session.typeCode })
  } catch (error) {
    // 근거는 화면의 부속이다. 없으면 그 카드만 빠지고 결과 화면은 그대로 뜬다.
    // 500을 돌려주면 화면이 에러 처리를 해야 하므로 data: null로 내린다
    console.error("GET /api/diagnosis/reason:", error)
    return ok(null)
  }

  await prisma.diagnosisSession.update({
    where: { id: session.id },
    data: { reasonText: lines.join("\n") },
  })

  return ok({ lines })
}
