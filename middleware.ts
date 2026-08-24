import { NextResponse, type NextRequest } from "next/server"
import { cdnOrigin } from "@/lib/assets"
import { appOrigin } from "@/lib/oauth"

// 소유자: E(인프라). 미인증 방문자를 /login으로 보내고, 요청마다 CSP nonce를 만든다.
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

// 로그인 없이 열려야 하는 경로.
//
// "/"가 여기 있는 이유(2026-08-22): 전에는 홈도 막혀서 처음 온 사람이 주소를 치면
// 설명 한 줄 없는 로그인 폼부터 봤다. app/page.tsx에 비로그인 소개 화면(종족 소개·
// "낙인을 만들지 않아요"·시작하기 버튼)이 이미 있는데 도달할 수 없는 코드였다.
// 첫 화면이 전환의 전부인 서비스에서 랜딩이 없는 것은 기능 누락이다.
// 홈은 fetch 실패를 미인증으로 취급하고, 레이아웃도 프로필 null을 이미 견딘다
// (lib/profile.ts는 null을 돌려주고 Sidebar·ChatLauncher는 그리지 않는다).
// 홈은 하위 경로가 없으므로 아래 접두사 규칙에 섞지 않고 따로 본다 —
// "/"를 이 배열에 넣으면 startsWith("//")가 우연히 거짓이라 동작은 하지만,
// 읽는 사람에게는 "전부 공개"로 보인다.
const PUBLIC_PATHS = ["/login", "/signup"]

// 사용자 사진을 올리고 내려받는 곳. 버킷 이름이 호스트에 붙는 가상 호스트 방식이라
// 와일드카드가 필요하다(lib/missions/upload.ts의 S3Client 기본값).
// 리전을 S3_REGION이 아니라 AWS_REGION에서 읽는 것도 그 파일과 같다.
const S3_HOST = `https://*.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`

// 펫·치장·배경 그림을 내려주는 CloudFront. 2026-08-24에 그림 출처가 public/art에서
// 여기로 바뀌면서 img-src에 추가가 필요해졌다 — 없으면 브라우저가 그림을 전부 차단하고
// 화면에는 이모지 폴백만 남는다(로컬 실행에서 pets/fox-4.png 차단 로그로 잡았다).
// origin 조립 규칙은 lib/assets.ts 한 곳에만 둔다. 도메인이 비면 빈 문자열이라
// CSP에 아무것도 추가되지 않는다(그때는 cdnUrl()도 null이라 그림 자체가 없다).
const CDN_HOST = cdnOrigin() ?? ""

/**
 * 요청 1건당 nonce 1개를 만들어 CSP를 붙인다.
 *
 * script-src에 nonce + 'strict-dynamic'을 걸면, 공격자가 어떤 경로로든 <script>를
 * 문서에 심어도 nonce가 없어 실행되지 않는다. 커뮤니티 글·닉네임·채팅처럼
 * 사용자 문자열이 화면에 들어가는 곳이 여럿이라 이 방어가 실제로 값을 한다.
 *
 * style-src는 'unsafe-inline'이다. 이 앱 화면은 Figma에서 옮겨온 style={{...}} 속성으로
 * 그려진다 — 속성 인라인 스타일은 nonce로 허용할 수 없다(CSP는 style 속성에
 * nonce를 적용하지 않는다). 여기서 nonce만 걸면 앱이 전부 스타일 없이 뜬다.
 * script-src가 XSS를 막는 축이고 style-src는 그 축이 아니다 — 둘을 같이 묶어
 * "그럼 CSP를 아예 안 넣는다"로 가는 것이 전에 한 잘못된 판단이었다.
 *
 * font-src가 'self'로 닫힌 것은 서체를 next/font로 자체 호스팅한 결과다.
 * @import로 fonts.gstatic.com을 쓰던 때는 이 값을 열어야 했다.
 */
function cspFor(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development"
  return [
    "default-src 'self'",
    // 'unsafe-eval'은 dev 전용이다. React가 서버 스택을 브라우저에서 복원할 때 쓴다
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // blob: 은 업로드 전 미리보기(URL.createObjectURL), data: 는 인라인 아이콘
    `img-src 'self' blob: data: ${S3_HOST}${CDN_HOST ? ` ${CDN_HOST}` : ""}`,
    "font-src 'self'",
    // presigned PUT은 S3로 직접 나간다. 나머지는 우리 API·채팅 스트림
    `connect-src 'self' ${S3_HOST}${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    // 로그인 폼이 외부로 POST되는 경로를 막는다
    "form-action 'self'",
    // X-Frame-Options: DENY와 같은 뜻. 최신 브라우저는 이쪽을 본다
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    // localhost는 http라 dev에서 켜면 자기 자원을 https로 올려 전부 깨진다
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

export function middleware(request: NextRequest) {
  // nonce는 요청마다 새로 만든다. 재사용하면 공격자가 한 번 본 값을 다시 쓸 수 있다
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = cspFor(nonce)

  // Next는 요청 헤더의 CSP에서 'nonce-...'를 꺼내 자기 <script>에 붙인다.
  // 그래서 응답뿐 아니라 요청 헤더에도 같은 값을 실어야 한다
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const pass = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set("Content-Security-Policy", csp)
    return response
  }

  // 로컬 개발 우회. getCurrentUser()가 쿠키 없이 팀 계정을 돌려주는 모드라
  // 여기서 막으면 로컬에서 아무 화면도 못 연다. 배포 환경에서는 절대 true가 아니다
  if (process.env.DEV_AUTH_BYPASS === "true") return pass()

  const { pathname, search } = request.nextUrl

  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return pass()
  }

  const hasSession =
    Boolean(request.cookies.get(SESSION_COOKIE)?.value) ||
    Boolean(request.cookies.get(LEGACY_COOKIE)?.value)

  if (hasSession) return pass()

  // 로그인 후 원래 가려던 곳으로 돌아갈 수 있게 남겨둔다.
  // 열린 리다이렉트를 막기 위해 경로만 싣는다 — 절대 URL은 싣지 않는다
  // "/"는 위에서 이미 통과했으므로 여기 오는 경로는 항상 홈이 아니다
  //
  // **여기는 절대 URL이어야 한다. 라우트 핸들러와 규칙이 다르다.**
  //
  // 2026-08-24에 이 자리를 상대 경로 Location으로 바꿨다가 되돌렸다. 이유는 Next가
  // 미들웨어 응답의 Location을 자기가 `new URL(location)`으로 파싱하기 때문이다 —
  // 상대 경로면 그 자리에서 던진다:
  //   TypeError: Invalid URL  code: ERR_INVALID_URL  input: '/login?next=%2Fpet'
  // 그래서 로그인 안 한 사람이 /pet을 열면 로그인 화면이 아니라 **500**을 받았다.
  // `npm run e2e`의 "/pet은 /login으로 보낸다"가 이것을 잡았다(check:* 9종은 못 잡는다 —
  // 미인증 리다이렉트를 검사하는 것은 e2e뿐이다).
  // `lib/oauth.ts`의 appRedirect()가 상대 경로로 되는 것은 그쪽이 라우트 핸들러라
  // 응답이 Next의 미들웨어 검증을 지나지 않기 때문이다.
  //
  // 그러면 원래 함정(request.url의 host가 Amplify SSR에서 localhost:3000이다)이 돌아오므로
  // origin을 request.url이 아니라 appOrigin()에서 얻는다 — APP_ORIGIN 환경변수가 먼저고,
  // 없으면 x-forwarded-host(localhost는 건너뛴다), 최후에 request.url이다.
  // 로컬에서는 마지막 갈래로 떨어져 http://localhost:3000이 되고 그게 맞는 값이다.
  const login = new URL("/login", appOrigin(request))
  // 로그인 후 원래 가려던 곳으로 돌아갈 수 있게 남긴다. 열린 리다이렉트를 막기 위해
  // 경로만 싣는다 — 절대 URL은 싣지 않는다
  login.searchParams.set("next", `${pathname}${search}`)
  // 307을 유지한다. 보호된 API에 POST하던 요청의 실패 모양을 바꾸지 않는다
  const redirect = NextResponse.redirect(login, 307)
  redirect.headers.set("Content-Security-Policy", csp)
  return redirect
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
