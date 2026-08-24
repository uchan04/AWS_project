"use client"

// 소유자: A. 루트 레이아웃 자체가 죽었을 때의 최후 경계.
//
// app/error.tsx는 레이아웃 안에서 렌더된다. 그래서 레이아웃이 던지는 경우
// (getSidebarProfile이 UnauthorizedError가 아닌 예외로 죽는 등)에는 잡지 못한다.
// 이 파일은 <html>·<body>를 직접 그린다 — 레이아웃을 아예 쓰지 않는다.
//
// tokens.css를 import하지 않는다. 스타일시트 로딩이 실패해서 여기 온 경우까지
// 받아야 하므로 색과 서체를 인라인으로 적는다.
//
// 서체도 next/font를 쓰지 않는다. --font-gowun-dodum은 app/layout.tsx가 <html>에
// 심는 변수인데 이 파일은 그 레이아웃을 아예 대체한다 — 변수가 없어 무시된다.
// 시스템 서체가 이 화면의 올바른 답이다. (2026-08-23부터 본문은 모든 화면이
// 시스템 서체다 — app/globals.css의 --font-korean-system)

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F5F0E8",
          color: "#2A1F14",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 380, textAlign: "center" }}>
          <p style={{ fontSize: 44, margin: "0 0 12px" }} aria-hidden="true">
            🌙
          </p>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>잠깐 문제가 생겼어요</h1>
          <p style={{ fontSize: 14, color: "#7A6B58", margin: "0 0 20px", lineHeight: 1.6 }}>
            서비스 쪽 문제예요. 다시 불러오면 대부분 해결됩니다.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              width: "100%",
              padding: "13px 16px",
              border: "none",
              borderRadius: 12,
              background: "#A9542A",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            다시 불러오기
          </button>
          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 12, color: "#7A6B58" }}>
              문의할 때 알려주세요: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  )
}
