// 소유자: E. 이메일+비밀번호 회원가입.
// 이메일 인증 코드는 만들지 않는다(CLAUDE.md 8절) — 가입 즉시 확정 계정으로 만들고 바로 로그인시킨다.
//
// 2026-08-21 A 변경(E에게 통보): Cognito AdminCreateUser 대신 자체 DB에 계정을 만든다.
// 이유는 두 가지다. (1) AdminCreateUser는 IAM 자격증명이 필요해 로컬에서 가입 자체가 되지 않았다.
// (2) 흐름이 "가입 → 진단 문항 → 결과"로 확정되어 가입 직후 User 행이 반드시 있어야 한다.
// Google 로그인은 Cognito를 계속 쓴다(별도 라우트). 그 계정은 passwordHash가 null이다.

import { fail, ok } from "@/lib/api"
import { localCognitoSub, setLocalSessionCookie } from "@/lib/auth"
import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { clientKey, recordAttempt, retryAfter } from "@/lib/ratelimit"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8

// 가입은 성공도 센다. 막으려는 것이 "한 IP에서 계정을 대량 생성하는 것"이라 성공을 빼면
// 세는 의미가 없다. 한 사람이 한 시간에 계정 5개를 만드는 정상 상황은 없다.
const SIGNUP_LIMIT = 5
const SIGNUP_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  const key = `signup:${clientKey(request)}`
  const wait = retryAfter(key, SIGNUP_LIMIT)
  if (wait > 0) {
    const minutes = Math.ceil(wait / 60)
    return fail(
      "TOO_MANY_ATTEMPTS",
      `가입 시도가 너무 많습니다. ${minutes}분 후에 다시 시도해 주세요`,
      400
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail("INVALID_BODY", "요청 형식이 올바르지 않습니다", 400)
  }

  const { email, password } = (body as { email?: unknown; password?: unknown }) ?? {}
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return fail("INVALID_EMAIL", "올바른 이메일 형식이 아닙니다", 400)
  }
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return fail("INVALID_PASSWORD", `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다`, 400)
  }

  // 형식 검증을 통과한 요청만 센다. 오타(8자 미만)로 다섯 번 막히면 정상 사용자가 한 시간 잠긴다
  recordAttempt(key, SIGNUP_WINDOW_MS)

  // 유니크 제약에 맡기지 않고 먼저 본다. 제약 위반을 500으로 흘리면 화면에 안내가 안 나간다
  if (await prisma.user.findUnique({ where: { email } })) {
    return fail("EMAIL_TAKEN", "이미 가입된 이메일입니다", 400)
  }

  // 평문 비밀번호는 저장하지 않는다. 로그·에러 메시지에도 남기지 않는다
  const user = await prisma.user.create({
    data: {
      cognitoSub: localCognitoSub(),
      email,
      passwordHash: hashPassword(password),
    },
  })

  await setLocalSessionCookie(user.id)
  return ok({})
}
