// 소유자: E. Hosted UI(Google 로그인)가 쓰는 redirect_uri를 한 곳에서 만든다.
//
// 왜 요청 origin에서 유도하지 않는가: Amplify SSR은 CloudFront 뒤의 Lambda에서 돌고,
// 거기서 new URL(request.url).origin은 http:// 로 나오는 경우가 있다. Cognito의
// 콜백 URL 검증은 문자열 완전 일치라, 스킴 하나가 달라도 redirect_mismatch로 떨어진다.
// /api/auth/google과 /api/auth/callback이 서로 다른 값을 보내면 토큰 교환도 깨진다.
// COGNITO_REDIRECT_URI에 Cognito App Client에 등록한 값을 그대로 박아 두고 둘이 공유한다.
//
// Cognito App Client(welli-web-client)에 등록된 콜백 (2026-08-23):
//   https://main.d2ynoyp44lt46h.amplifyapp.com/api/auth/callback
//   http://localhost:3000/api/auth/callback

/**
 * 환경변수가 없으면 요청 origin으로 되돌아간다. 로컬 개발(localhost:3000)은
 * 그 폴백만으로 맞고, 배포 환경은 Amplify 환경변수에 등록되어 있다.
 */
export function redirectUri(origin: string): string {
  return process.env.COGNITO_REDIRECT_URI || `${origin}/api/auth/callback`
}

/**
 * 앱 내부 경로로 보내는 리다이렉트. **절대 URL을 만들지 않는 것이 요점이다.**
 *
 * 위 주석의 함정이 redirect_uri에만 있는 게 아니었다. Amplify SSR은 Lambda 안에서
 * Next 서버를 localhost:3000으로 띄우고 그 앞에 CloudFront가 붙는 구조라, Route
 * Handler가 받는 request.url의 host가 공개 도메인이 아니라 **localhost:3000**이다.
 * 그 값으로 new URL("/login", request.url) 같은 절대 URL을 만들어 Location에 실으면
 * 브라우저가 사용자 PC의 3000번을 찾아가 "연결을 거부했습니다"로 끝난다.
 * 2026-08-24 배포 환경에서 실제 응답으로 확인했다 —
 *   POST /api/auth/logout   → location: https://localhost:3000/login
 *   GET  /api/auth/callback → location: https://localhost:3000/login
 * 로그인은 토큰 교환까지 성공한 뒤 **마지막 리다이렉트에서만** 깨져서 원인이 안 보였다.
 *
 * Location에 상대 경로를 넣으면 브라우저가 자기가 실제로 접속한 주소를 기준으로
 * 해석한다(RFC 7231 §7.1.2). 로컬·main 배포·프리뷰 브랜치가 도메인이 달라도 전부
 * 맞고, 환경변수를 새로 박을 필요가 없다 — APP_ORIGIN 같은 걸 추가하면 Amplify 콘솔
 * 등록과 amplify.yml grep 목록에 이중으로 넣어야 하고, 빠뜨리면 런타임 undefined다.
 *
 * 303을 쓰는 이유: POST /api/auth/logout 에 307이면 브라우저가 /login으로 **다시
 * POST**한다. /login은 페이지라 405가 된다. 303은 다음 요청을 GET으로 바꾼다.
 *
 * NextResponse.redirect()는 절대 URL을 요구하므로 여기서는 쓸 수 없다. Next 16 문서는
 * Route Handler에 next/navigation의 redirect()를 안내하지만(상대 경로 허용), 그쪽은
 * throw로 동작하고 Location 생성을 프레임워크에 맡긴다. 이 버그가 바로 프레임워크의
 * URL 해석에서 나온 것이라 헤더를 직접 통제한다.
 */
export function appRedirect(path: string, status = 303): Response {
  return new Response(null, { status, headers: { Location: path } })
}
