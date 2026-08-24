// 소유자: A. 비밀번호 변경. 로그인한 사용자가 현재 비밀번호를 확인받고 바꾼다.
//
// 비밀번호 "찾기"(재설정)는 만들지 않는다 — 메일 발송 경로가 없다(SES 미검증이고
// 새 의존성을 넣지 않는다). 그래서 잊으면 복구가 안 된다. 이 화면이 유일한 변경 수단이다.
//
// Google로 가입한 계정은 passwordHash가 null이다. 여기서 비밀번호를 새로 만들어 주면
// Google 계정 하나로 이메일 로그인 경로가 열리는 셈이라 막고 안내만 한다.

import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { hashPassword, verifyPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"

const PASSWORD_MIN = 8

export async function POST(request: Request) {
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
    return fail("INVALID_BODY", "요청 형식이 올바르지 않습니다", 400)
  }

  const { currentPassword, newPassword } = (body as {
    currentPassword?: unknown
    newPassword?: unknown
  }) ?? {}

  if (!user.passwordHash) {
    return fail(
      "NO_PASSWORD_ACCOUNT",
      "Google로 로그인한 계정이라 비밀번호가 없습니다. Google에서 관리해 주세요",
      400
    )
  }
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return fail("INVALID_BODY", "현재 비밀번호와 새 비밀번호를 입력해 주세요", 400)
  }
  if (newPassword.length < PASSWORD_MIN) {
    return fail("INVALID_PASSWORD", `새 비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다`, 400)
  }
  if (newPassword === currentPassword) {
    return fail("SAME_PASSWORD", "지금 쓰는 비밀번호와 다르게 정해 주세요", 400)
  }

  // 세션 쿠키만으로 바꾸게 하면 남의 기기에 열린 화면으로 비밀번호를 갈아치울 수 있다
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return fail("INVALID_CREDENTIALS", "현재 비밀번호가 올바르지 않습니다", 401)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  })

  // 다른 기기의 세션은 만료(7일)까지 살아 있다. 세션 표가 없어 무효화할 방법이 없다 —
  // 화면에서 이 사실을 알린다. 강제 로그아웃이 필요해지면 User에 세션 세대 컬럼이 필요하다
  return ok({})
}
