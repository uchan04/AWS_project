// 소유자: E. 이메일+비밀번호 로그인.

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider"
import { fail, ok } from "@/lib/api"
import { setLocalSessionCookie, signInWithCognitoToken } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { clearAttempts, clientKey, recordAttempt, retryAfter } from "@/lib/ratelimit"

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION })

// 실패만 센다. 성공하면 지운다 — 공용 IP(학교·카페 NAT)를 쓰는 정상 사용자가
// 남의 실패 기록에 막히지 않게 한다.
const LOGIN_LIMIT = 10
const LOGIN_WINDOW_MS = 5 * 60 * 1000

export async function POST(request: Request) {
  // 레이트 리밋을 body 파싱보다 먼저 본다. 막을 요청에 JSON 파싱과 DB 조회를 들이지 않는다.
  const key = `login:${clientKey(request)}`
  const wait = retryAfter(key, LOGIN_LIMIT)
  if (wait > 0) {
    // 429가 맞는 코드지만 CLAUDE.md 7절이 상태 코드를 5개로 고정했다. 화면은 message만 읽는다
    return fail(
      "TOO_MANY_ATTEMPTS",
      `로그인 시도가 너무 많습니다. ${wait}초 후에 다시 시도해 주세요`,
      400
    )
  }

  /** 실패 응답 + 시도 1회 기록. 로그인 실패는 전부 이 함수를 지난다. */
  const rejected = (code: string, message: string) => {
    recordAttempt(key, LOGIN_WINDOW_MS)
    return fail(code, message, 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail("INVALID_BODY", "요청 형식이 올바르지 않습니다", 400)
  }

  const { email, password } = (body as { email?: unknown; password?: unknown }) ?? {}
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return fail("INVALID_BODY", "이메일과 비밀번호를 입력해 주세요", 400)
  }

  // 자체 DB 계정(A 추가, 2026-08-21). passwordHash가 있는 계정은 Cognito를 거치지 않는다.
  // Cognito로 만든 계정(Google 로그인 등)은 passwordHash가 null이라 아래 Cognito 경로로 내려간다.
  const local = await prisma.user.findUnique({ where: { email } })
  if (local?.passwordHash) {
    if (!verifyPassword(password, local.passwordHash)) {
      return rejected("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다")
    }
    await setLocalSessionCookie(local.id)
    clearAttempts(key)
    return ok({})
  }

  try {
    const auth = await client.send(
      new InitiateAuthCommand({
        ClientId: process.env.COGNITO_CLIENT_ID ?? "",
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: email, PASSWORD: password },
      })
    )

    const accessToken = auth.AuthenticationResult?.AccessToken
    if (!accessToken) return rejected("LOGIN_FAILED", "로그인에 실패했습니다")

    // Cognito 토큰은 쿠키에 담지 않는다. 자체 세션(7일)으로 바꿔 자체 계정과 수명을 맞춘다
    if (!(await signInWithCognitoToken(accessToken))) {
      return rejected("LOGIN_FAILED", "로그인에 실패했습니다")
    }
    clearAttempts(key)
    return ok({})
  } catch (error) {
    if (error instanceof NotAuthorizedException || error instanceof UserNotFoundException) {
      return rejected("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다")
    }
    // InvalidParameterException(App Client에 USER_PASSWORD_AUTH 미허용),
    // ResourceNotFoundException(잘못된 ClientId·리전) 등은 자격증명 문제가 아니라 설정 문제다.
    // 그냥 throw하면 화면에 안내가 없는 500이 되고 로그도 안 남았다(2026-08-23).
    // 상태 코드는 CLAUDE.md 7절이 정한 5종만 쓴다
    console.error("[auth/login] Cognito InitiateAuth 실패", error)
    return fail("LOGIN_UNAVAILABLE", "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요", 500)
  }
}
