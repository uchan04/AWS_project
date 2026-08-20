// 소유자: E. 이메일+비밀번호 로그인.

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider"
import { fail, ok } from "@/lib/api"
import { setSessionCookie } from "@/lib/auth"

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

    await setSessionCookie(accessToken, auth.AuthenticationResult?.ExpiresIn ?? 3600)
    return ok({})
  } catch (error) {
    if (error instanceof NotAuthorizedException || error instanceof UserNotFoundException) {
      return fail("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다", 401)
    }
    throw error
  }
}
