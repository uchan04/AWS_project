// 소유자: E (2026-08-21 A 수정, E에게 통보). Google 로그인 콜백 — authorization code를 Cognito 토큰으로 교환한다.
// App Client가 시크릿 없는 public client라 별도 인증 헤더가 필요 없다.
//
// redirect_uri는 /api/auth/google이 authorize에 보낸 값과 문자 단위로 같아야 한다.
// 그래서 양쪽 모두 lib/oauth.ts의 appOrigin()만 쓴다.

import { NextResponse } from "next/server"
import { setSessionCookie } from "@/lib/auth"
import { appOrigin, cognitoDomain } from "@/lib/oauth"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const domain = cognitoDomain()
  const origin = appOrigin(request)

  // Cognito가 에러로 돌려보낸 경우(사용자 취소, redirect_mismatch 등)도 여기로 온다.
  // 조용히 /login으로 보내면 원인을 찾을 수 없어서 CloudWatch에 남긴다. code는 남기지 않는다.
  const oauthError = url.searchParams.get("error")
  if (oauthError) {
    console.error("GET /api/auth/callback: Cognito 오류", oauthError, url.searchParams.get("error_description"))
    return NextResponse.redirect(new URL("/login", origin))
  }

  if (!code || !domain) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  const tokenResponse = await fetch(`https://${domain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.COGNITO_CLIENT_ID ?? "",
      code,
      redirect_uri: `${origin}/api/auth/callback`,
    }),
  })

  if (!tokenResponse.ok) {
    // 실패 응답 본문에는 토큰이 없다(에러 코드뿐이라 남겨도 안전하다).
    console.error("GET /api/auth/callback: 토큰 교환 실패", tokenResponse.status, await tokenResponse.text())
    return NextResponse.redirect(new URL("/login", origin))
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string; expires_in?: number }
  if (!tokens.access_token) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  await setSessionCookie(tokens.access_token, tokens.expires_in ?? 3600)
  return NextResponse.redirect(new URL("/", origin))
}
