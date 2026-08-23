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
