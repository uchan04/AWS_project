// 소유자: E. Cognito Hosted UI의 Google IdP로 리다이렉트한다.
// COGNITO_DOMAIN이 비어 있으면(Google Cloud 자격증명 연결 전) 503을 돌려준다.

import { NextResponse } from "next/server"
import { redirectUri } from "@/lib/cognito"

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const domain = process.env.COGNITO_DOMAIN
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

  const params = new URLSearchParams({
    identity_provider: "Google",
    response_type: "code",
    client_id: process.env.COGNITO_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    scope: "openid email profile",
  })

  return NextResponse.redirect(`https://${domain}/oauth2/authorize?${params.toString()}`)
}
