// Cognito Hosted UI(Google 로그인) 조립에 필요한 두 값. app/api/auth/{google,callback}이 함께 쓴다.
//
// 2026-08-21 프로덕션에서 두 가지가 동시에 깨져 있었다.
//  1) COGNITO_DOMAIN 콘솔 값에 스킴이 들어 있어 `https://${domain}`이 `https://https//…`가 됐다
//  2) redirect_uri가 `https://localhost:3000/api/auth/callback`으로 나가 Cognito가 redirect_mismatch로 거부했다
// 둘 다 값의 출처를 한 곳으로 모아 막는다.

/** 스킴·끝 슬래시·경로를 벗긴 Cognito 도메인. 없으면 null (호출부가 503으로 안내한다) */
export function cognitoDomain(): string | null {
  const raw = process.env.COGNITO_DOMAIN?.trim()
  if (!raw) return null
  const stripped = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  return stripped || null
}

/**
 * 브라우저가 실제로 보고 있는 오리진.
 *
 * Amplify SSR 컴퓨트에서 `new URL(request.url).origin`은 Lambda 내부 호스트(localhost:3000)를 준다.
 * 그 값을 OAuth redirect_uri에 쓰면 Cognito에 등록된 콜백과 달라 로그인이 시작조차 안 된다.
 * 우선순위: APP_ORIGIN(빌드 시 amplify.yml이 넣는다) → 프록시 헤더 → 요청 URL(로컬 개발).
 */
export function appOrigin(request: Request): string {
  const explicit = process.env.APP_ORIGIN?.trim().replace(/\/+$/, "")
  if (explicit) return explicit

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https"
    return `${proto}://${host}`
  }

  return new URL(request.url).origin
}
