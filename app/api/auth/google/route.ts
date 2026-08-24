// 소유자: E (2026-08-21 A 수정, E에게 통보). Cognito Hosted UI의 Google IdP로 리다이렉트한다.
// COGNITO_DOMAIN이 비어 있으면(Google Cloud 자격증명 연결 전) 503을 돌려준다.
//
// 도메인과 오리진은 lib/oauth.ts가 만든다. request.url의 오리진을 그대로 쓰면
// 배포 환경에서 redirect_uri가 localhost로 나가 Cognito가 거부한다.

import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE, appOrigin, cognitoDomain } from "@/lib/oauth"

export async function GET(request: Request) {
  const domain = cognitoDomain()
  if (!domain) {
    return NextResponse.json(
      {
        error: {
          code: "GOOGLE_LOGIN_NOT_CONFIGURED",
          message: "Google 로그인이 아직 설정되지 않았습니다. 이메일로 로그인해 주세요",
        },
      },
      { status: 503 }
    )
  }

  // CSRF 방어용 state(A, 2026-08-22). 쿠키에 같은 값을 심고 콜백에서 대조한다.
  // 이게 없으면 공격자가 자기 code로 만든 콜백 링크를 피해자에게 열게 해서
  // 피해자를 공격자 계정에 로그인시킬 수 있다.
  const state = randomUUID()
  ;(await cookies()).set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict면 Cognito에서 돌아오는 최상위 이동에 쿠키가 실리지 않아 정상 로그인이 전부 막힌다
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  })

  const params = new URLSearchParams({
    identity_provider: "Google",
    response_type: "code",
    client_id: process.env.COGNITO_CLIENT_ID ?? "",
    // 콜백이 토큰 교환에서 보내는 값과 **문자 단위로** 같아야 한다. 양쪽 다 appOrigin()만 쓴다
    redirect_uri: `${appOrigin(request)}/api/auth/callback`,
    scope: "openid email profile",
    state,
  })

  return NextResponse.redirect(`https://${domain}/oauth2/authorize?${params.toString()}`)
}
