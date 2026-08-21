// 소유자: E (2026-08-21 A 수정, E에게 통보). Cognito Hosted UI의 Google IdP로 리다이렉트한다.
// COGNITO_DOMAIN이 비어 있으면(Google Cloud 자격증명 연결 전) 503을 돌려준다.
//
// 도메인과 오리진은 lib/oauth.ts가 만든다. request.url의 오리진을 그대로 쓰면
// 배포 환경에서 redirect_uri가 localhost로 나가 Cognito가 거부한다.

import { NextResponse } from "next/server"
import { appOrigin, cognitoDomain } from "@/lib/oauth"

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

  const params = new URLSearchParams({
    identity_provider: "Google",
    response_type: "code",
    client_id: process.env.COGNITO_CLIENT_ID ?? "",
    redirect_uri: `${appOrigin(request)}/api/auth/callback`,
    scope: "openid email profile",
  })

  return NextResponse.redirect(`https://${domain}/oauth2/authorize?${params.toString()}`)
}
