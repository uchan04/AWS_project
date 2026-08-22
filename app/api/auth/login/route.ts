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

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION })

export async function POST(request: Request) {
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
      return fail("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다", 401)
    }
    await setLocalSessionCookie(local.id)
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
    if (!accessToken) return fail("LOGIN_FAILED", "로그인에 실패했습니다", 401)

    // Cognito 토큰은 쿠키에 담지 않는다. 자체 세션(7일)으로 바꿔 자체 계정과 수명을 맞춘다
    if (!(await signInWithCognitoToken(accessToken))) {
      return fail("LOGIN_FAILED", "로그인에 실패했습니다", 401)
    }
    return ok({})
  } catch (error) {
    if (error instanceof NotAuthorizedException || error instanceof UserNotFoundException) {
      return fail("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다", 401)
    }
    throw error
  }
}
