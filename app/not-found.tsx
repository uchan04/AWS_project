import Link from "next/link"
import "@/styles/tokens.css"

// 소유자: A. 404. 없으면 Next 기본 흑백 "404 | This page could not be found"가 뜬다.
// 하단 탭 내비게이션이 있는 서비스라 오타로 들어온 사용자가 돌아갈 입구를 여기서 준다.

export const metadata = { title: "찾을 수 없는 페이지" }

export default function NotFound() {
  return (
    <main className="hm" style={{ padding: "48px 20px", maxWidth: 480, margin: "0 auto" }}>
      <div className="hm-card" style={{ textAlign: "center" }}>
        <p style={{ fontSize: 44, margin: "0 0 12px" }} aria-hidden="true">
          🧭
        </p>
        <h1 className="hm-card__title" style={{ marginBottom: 8 }}>
          없는 길로 오셨어요
        </h1>
        <p style={{ color: "var(--color-muted)", fontSize: 14, margin: "0 0 20px" }}>
          주소가 바뀌었거나 사라진 화면이에요.
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          <Link className="hm-btn" href="/">
            홈으로
          </Link>
          <Link className="hm-btn hm-btn--ghost" href="/missions">
            오늘의 미션 보기
          </Link>
        </div>
      </div>
    </main>
  )
}
