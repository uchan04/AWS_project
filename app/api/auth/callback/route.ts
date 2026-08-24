// 소유자: E (2026-08-21 A 수정, 2026-08-24 E와 합침). Google 로그인 콜백 —
// authorization code를 Cognito 토큰으로 교환한다.
// App Client가 시크릿 없는 public client라 별도 인증 헤더가 필요 없다.
//
// URL을 두 종류로 나눠 쓴다. 섞으면 로그인이 조용히 깨진다.
//   · Cognito에 **보내는** redirect_uri → 절대 URL이어야 하고 등록값과 문자 단위로 같아야
//     한다. /api/auth/google이 authorize에 보낸 값과도 같아야 하므로 양쪽이 appOrigin()만 쓴다.
//   · 브라우저에 **돌려주는** Location → 상대 경로만 쓴다(appRedirect). 이유는 lib/oauth.ts 주석.

import { cookies } from "next/headers"
import { signInWithCognitoToken } from "@/lib/auth"
import { OAUTH_STATE_COOKIE, appOrigin, appRedirect, cognitoDomain } from "@/lib/oauth"

// 실패하면 전부 /login으로 되돌린다. 화면에는 아무 설명도 남지 않으므로 원인은 반드시
// 로그로 남긴다 — 로그가 없어서 "버튼 누르면 로그인 화면으로 돌아온다"만 보이던 게
// 2026-08-23 디버깅을 막았다. CloudWatch의 SSR 로그 그룹에서 이 문자열로 찾는다.
function bounce(reason: string) {
  console.error(`[auth/callback] ${reason}`)
  // url.origin은 배포 환경에서 https://localhost:3000이다. appRedirect 주석 참고
  return appRedirect("/login")
}

export async function GET(request: Request) {
  // 경로·쿼리는 정확하다. host만 배포 환경에서 localhost:3000이라 리다이렉트에는 쓰지 않는다
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const domain = cognitoDomain()
  const origin = appOrigin(request)

  // Hosted UI가 거절하면 code 대신 error를 붙여 되돌아온다(사용자 취소, redirect_mismatch 등)
  const oauthError = url.searchParams.get("error")
  if (oauthError) {
    return bounce(`Hosted UI 오류: ${oauthError} ${url.searchParams.get("error_description") ?? ""}`)
  }
  if (!code) return bounce("code 파라미터 없음")
  if (!domain) return bounce("COGNITO_DOMAIN 미설정 — 런타임에 환경변수가 전달되지 않았다")

  // CSRF 방어(A, 2026-08-22). state가 없거나 /api/auth/google이 심은 쿠키와 다르면 버린다.
  // 이걸 검사하지 않으면 공격자가 자기 code로 만든 링크를 피해자에게 열게 해서
  // 피해자를 공격자 계정에 로그인시킬 수 있다. 쿠키는 한 번 쓰고 지운다.
  const jar = await cookies()
  const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value
  jar.delete(OAUTH_STATE_COOKIE)
  if (!expectedState || url.searchParams.get("state") !== expectedState) {
    return bounce("state 불일치 — CSRF 방어에 걸렸다")
  }

  // fetch 자체가 throw하는 경우(DNS 실패, Cognito 장애, 타임아웃)도 감싼다.
  // 감싸지 않으면 로그인 실패가 500 스택 페이지로 나온다 — /login으로 돌려보내는 쪽이 낫다
  let tokenResponse: Response
  try {
    tokenResponse = await fetch(`https://${domain}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.COGNITO_CLIENT_ID ?? "",
        code,
        redirect_uri: `${origin}/api/auth/callback`,
      }),
    })
  } catch (error) {
    return bounce(`토큰 엔드포인트에 닿지 못했다: ${error}`)
  }

  if (!tokenResponse.ok) {
    // Cognito는 실패 본문에 error/error_description을 준다. 토큰은 여기 없다
    const detail = await tokenResponse.text().catch(() => "")
    return bounce(`토큰 교환 실패 ${tokenResponse.status}: ${detail.slice(0, 300)}`)
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string }
  if (!tokens.access_token) return bounce("토큰 응답에 access_token이 없다")

  // Cognito 토큰(1시간)을 쿠키에 담지 않는다. 자체 세션 쿠키(7일)로 바꾼다 — 그러지 않으면
  // Google로 들어온 사용자만 한 시간 뒤 조용히 로그아웃된다.
  const user = await signInWithCognitoToken(tokens.access_token)
  if (!user) return bounce("액세스 토큰 검증 실패")

  // 로그인이 여기까지 다 성공하고 마지막 리다이렉트에서만 localhost로 튕긴 적이 있다.
  // 진단 전이면 결과가 없으니 홈이 소개 화면을 띄운다 — 별도 분기가 필요하지 않다
  return appRedirect("/")
}
