import type { NextConfig } from "next";

// 소유자: E.
//
// 2026-08-22: 보안 헤더와 정적 자산 캐시를 추가했다. Amplify Hosting은 앱이 헤더를
// 주지 않으면 아무것도 붙여주지 않는다 — 심사 항목이기도 하고, 실제로 없으면
// 클릭재킹(iframe에 우리 화면을 얹고 로그인 유도)과 MIME 스니핑이 열려 있다.
//
// CSP는 여기가 아니라 middleware.ts에 있다. 요청마다 nonce를 새로 만들어야 하고
// next.config의 headers()는 정적 문자열만 낼 수 있다.
// (전에는 "인라인 스타일 때문에 CSP를 아예 넣지 않는다"고 적어뒀는데 잘못된 판단이었다 —
//  style-src와 script-src는 별개다. 이유는 middleware.ts cspFor() 주석에 있다)

const securityHeaders = [
  // iframe 삽입 차단. 로그인 화면을 얹어 자격증명을 가로채는 경로를 막는다
  { key: "X-Frame-Options", value: "DENY" },
  // Content-Type을 브라우저가 임의로 재해석하지 않게 한다.
  // 사용자가 올린 사진이 text/html로 해석되면 저장형 XSS가 된다
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 외부 링크(커뮤니티 글 링크 등)로 나갈 때 우리 경로를 넘기지 않는다.
  // /diagnosis/result 같은 주소가 Referer에 실려 나가면 그 자체가 정보다
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 쓰지 않는 장치 권한을 미리 닫는다. 사진 미션은 <input type=file>이라 카메라 권한이
  // 필요하지 않다 (모바일에서 파일 선택 → 카메라는 OS가 처리한다)
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // public/art의 30장은 내용이 바뀌면 파일명이 바뀐다(scripts/slice-art.ts).
        // 기본값(no-cache)이면 화면을 옮길 때마다 5.5MB를 다시 물어본다
        source: "/art/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // 인증·개인 데이터를 돌려주는 경로는 절대 캐시되지 않아야 한다.
        // 공용 PC에서 뒤로가기로 앞사람 데이터가 뜨는 경우를 막는다
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
