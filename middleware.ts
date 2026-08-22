import { NextResponse, type NextRequest } from "next/server"

// 소유자: E(인프라). 미인증 방문자를 /login으로 보낸다.
//
// 왜 필요한가: 지금은 로그인하지 않고 /pet이나 /missions를 열면 각 화면의 try/catch가
// "불러오지 못했어요" 카드를 그린다. 사용자는 서비스가 고장 난 것으로 읽는다 —
// 실제로 필요한 안내는 "로그인해 주세요"다. 화면마다 그 분기를 넣는 대신 한 곳에서 막는다.
//
// ★ 이것은 보안 경계가 아니다. 쿠키의 "존재"만 본다 — 서명 검증은 lib/session.ts가
//   Node crypto로 하고 미들웨어는 Edge 런타임이라 같은 검증을 할 수 없다.
//   위조 쿠키를 들고 오면 여기는 통과하고 getCurrentUser()가 401로 막는다.
//   즉 여기는 UX 리다이렉트고, 인증은 여전히 모든 API·페이지의 첫 줄이 한다.

const SESSION_COOKIE = "session"
const LEGACY_COOKIE = "access_token"

// 로그인 없이 열려야 하는 경로
const PUBLIC_PATHS = ["/login", "/signup"]

export function middleware(request: NextRequest) {
  // 로컬 개발 우회. getCurrentUser()가 쿠키 없이 팀 계정을 돌려주는 모드라
  // 여기서 막으면 로컬에서 아무 화면도 못 연다. 배포 환경에서는 절대 true가 아니다
  if (process.env.DEV_AUTH_BYPASS === "true") return NextResponse.next()

  const { pathname, search } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const hasSession =
    Boolean(request.cookies.get(SESSION_COOKIE)?.value) ||
    Boolean(request.cookies.get(LEGACY_COOKIE)?.value)

  if (hasSession) return NextResponse.next()

  // 로그인 후 원래 가려던 곳으로 돌아갈 수 있게 남겨둔다.
  // 열린 리다이렉트를 막기 위해 경로만 싣는다 — 절대 URL은 싣지 않는다
  const login = new URL("/login", request.url)
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`)
  return NextResponse.redirect(login)
}

export const config = {
  // API·정적 자산·favicon·매니페스트는 건드리지 않는다.
  //   /api/*   — 자기 인증을 하고 401 JSON을 돌려줘야 한다. HTML 리다이렉트를 주면
  //              fetch 쪽에서 JSON 파싱이 깨져 "네트워크 오류"로 뭉개진다
  //   /art/*   — 펫 그림. 로그인 전 화면(로그인·404)도 쓴다
  matcher: [
    "/((?!api|_next/static|_next/image|art|favicon.ico|icon.svg|manifest.webmanifest|.*\\.png$|.*\\.svg$).*)",
  ],
}
