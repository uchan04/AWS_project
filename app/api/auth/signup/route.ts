// 소유자: E. 이메일+비밀번호 회원가입.
// 이메일 인증 코드는 만들지 않는다(CLAUDE.md 8절) — AdminCreateUser로 확정 계정을 만들고
// 바로 로그인시킨다. 사용자는 인증 메일을 보지 않는다.

import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider"
import { fail, ok } from "@/lib/api"
import { setSessionCookie } from "@/lib/auth"

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8

export async function POST(request: Request) {
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

  const userPoolId = process.env.COGNITO_USER_POOL_ID ?? ""
  const clientId = process.env.COGNITO_CLIENT_ID ?? ""

  try {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
        MessageAction: "SUPPRESS",
      })
    )
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      })
    )
  } catch (error) {
    if (error instanceof UsernameExistsException) {
      return fail("EMAIL_TAKEN", "이미 가입된 이메일입니다", 400)
    }
    throw error
  }

  const auth = await client.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
  )

  const accessToken = auth.AuthenticationResult?.AccessToken
  if (!accessToken) return fail("SIGNUP_FAILED", "가입에 실패했습니다. 다시 시도해 주세요", 500)

  await setSessionCookie(accessToken, auth.AuthenticationResult?.ExpiresIn ?? 3600)
  return ok({})
}
