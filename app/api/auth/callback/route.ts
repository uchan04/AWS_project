// 소유자: E. Google 로그인 콜백 — authorization code를 Cognito 토큰으로 교환한다.
// App Client가 시크릿 없는 public client라 별도 인증 헤더가 필요 없다.

import { NextResponse } from "next/server"
import { setSessionCookie } from "@/lib/auth"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const domain = process.env.COGNITO_DOMAIN

  if (!code || !domain) {
    return NextResponse.redirect(new URL("/login", url.origin))
  }

  const tokenResponse = await fetch(`https://${domain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.COGNITO_CLIENT_ID ?? "",
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  })

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/login", url.origin))
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string; expires_in?: number }
  if (!tokens.access_token) {
    return NextResponse.redirect(new URL("/login", url.origin))
  }

  await setSessionCookie(tokens.access_token, tokens.expires_in ?? 3600)
  return NextResponse.redirect(new URL("/", url.origin))
}
