// 소유자: E. Google 로그인 콜백 — authorization code를 Cognito 토큰으로 교환한다.
// App Client가 시크릿 없는 public client라 별도 인증 헤더가 필요 없다.

import { NextResponse } from "next/server"
import { setSessionCookie } from "@/lib/auth"
import { redirectUri } from "@/lib/cognito"

// 실패하면 전부 /login으로 되돌린다. 화면에는 아무 설명도 남지 않으므로 원인은 반드시
// 로그로 남긴다 — 로그가 없어서 "버튼 누르면 로그인 화면으로 돌아온다"만 보이던 게
// 2026-08-23 디버깅을 막았다. CloudWatch의 SSR 로그 그룹에서 이 문자열로 찾는다.
function bounce(url: URL, reason: string) {
  console.error(`[auth/callback] ${reason}`)
  return NextResponse.redirect(new URL("/login", url.origin))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const domain = process.env.COGNITO_DOMAIN

  // Hosted UI가 거절하면 code 대신 error를 붙여 되돌아온다(redirect_mismatch 등)
  const oauthError = url.searchParams.get("error")
  if (oauthError) {
    return bounce(url, `Hosted UI 오류: ${oauthError} ${url.searchParams.get("error_description") ?? ""}`)
  }
  if (!code) return bounce(url, "code 파라미터 없음")
  if (!domain) return bounce(url, "COGNITO_DOMAIN 미설정 — 런타임에 환경변수가 전달되지 않았다")

  const tokenResponse = await fetch(`https://${domain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.COGNITO_CLIENT_ID ?? "",
      code,
      redirect_uri: redirectUri(url.origin),
    }),
  })

  if (!tokenResponse.ok) {
    // Cognito는 실패 본문에 error/error_description을 준다. 토큰은 여기 없다
    const detail = await tokenResponse.text().catch(() => "")
    return bounce(url, `토큰 교환 실패 ${tokenResponse.status}: ${detail.slice(0, 300)}`)
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string; expires_in?: number }
  if (!tokens.access_token) {
    return bounce(url, "토큰 응답에 access_token이 없다")
  }

  await setSessionCookie(tokens.access_token, tokens.expires_in ?? 3600)
  return NextResponse.redirect(new URL("/", url.origin))
}
