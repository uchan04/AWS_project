// 소유자: A. 닉네임 변경. 진단 직후 결과 화면과 이후 프로필에서 같은 라우트를 쓴다.

import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { fail, ok } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import { isValidNickname } from "@/lib/types"

export async function PATCH(request: Request) {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail("INVALID_NICKNAME", "닉네임은 2~12자로 입력해 주세요", 400)
  }

  const raw = (body as { nickname?: unknown })?.nickname
  if (typeof raw !== "string" || !isValidNickname(raw)) {
    return fail("INVALID_NICKNAME", "닉네임은 2~12자로 입력해 주세요", 400)
  }

  const nickname = raw.trim()
  await prisma.user.update({ where: { id: user.id }, data: { nickname } })
  return ok({ nickname })
}
