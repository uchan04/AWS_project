"use client"

import { useEffect } from "react"
import Link from "next/link"
import "@/styles/tokens.css"

// 소유자: A. 라우트 에러 경계.
//
// 없으면 어떤 화면에서든 렌더 중 예외가 하나 터지면 Next 기본 화면이 뜬다 —
// 프로덕션에서는 "Application error: a client-side exception has occurred" 영문 문구다.
// 고립은둔청년 대상 서비스에서 그 화면은 "내가 뭘 잘못했나"로 읽힌다.
//
// 각 화면의 try/catch 폴백 카드와 역할이 다르다. 저건 데이터 읽기 실패를,
// 이건 렌더 자체가 죽은 경우를 받는다.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // CloudWatch로 나간다. digest로 서버 로그와 이어 붙일 수 있다
    console.error("[app/error]", error.digest, error)
  }, [error])

  return (
    <main className="hm" style={{ padding: "48px 20px", maxWidth: 480, margin: "0 auto" }}>
      <div className="hm-card" style={{ textAlign: "center" }}>
        <p style={{ fontSize: 44, margin: "0 0 12px" }} aria-hidden="true">
          🌱
        </p>
        <h1 className="hm-card__title" style={{ marginBottom: 8 }}>
          화면을 그리다가 멈췄어요
        </h1>
        <p style={{ color: "var(--color-muted)", fontSize: 14, margin: "0 0 20px" }}>
          잘못한 것이 없어요. 다시 시도하면 대부분 열립니다.
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" className="hm-btn" onClick={reset}>
            다시 시도
          </button>
          <Link className="hm-btn hm-btn--ghost" href="/">
            홈으로
          </Link>
        </div>

        {error.digest ? (
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--color-muted)" }}>
            문의할 때 알려주세요: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  )
}
