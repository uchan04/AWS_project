"use client"

// 소유자: E. 로그인 화면. 이메일+비밀번호와 Google을 함께 지원한다(CLAUDE.md 8절 갱신).
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Conversational FAQ.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import "@/styles/tokens.css"
import { login } from "../api"

export default function LoginPage() {
  const router = useRouter()

  // 미들웨어가 미인증 방문자를 여기로 보낼 때 원래 가려던 경로를 next로 남긴다
  // (middleware.ts). 로그인 후 그 자리로 돌려보낸다 — 없으면 항상 홈으로 튕겨서
  // 링크로 받은 커뮤니티 글을 열 수 없다.
  //
  // useSearchParams가 아니라 제출 시점에 location에서 읽는다 — 훅을 쓰면 이 페이지가
  // Suspense 경계를 요구해서 빌드가 경고를 낸다. 값이 필요한 시점은 제출 한 번뿐이다.
  //
  // 경로만 받는다. "//evil.com"이나 "https://evil.com"이 오면 홈으로 떨어뜨린다 —
  // 검증 없이 넘기면 우리 도메인에서 시작하는 피싱 링크를 만들 수 있다(열린 리다이렉트)
  function nextPathFromUrl(): string {
    const requested = new URLSearchParams(window.location.search).get("next")
    return requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/"
  }
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      router.push(nextPathFromUrl())
      // 사이드바 프로필은 layout.tsx가 서버에서 읽는다. 레이아웃은 클라이언트 이동으로
      // 재렌더되지 않으니 refresh 없이는 로그인 직후 홈에서 사이드바가 안 뜬다
      // (새로고침해야 뜨던 그 버그다. 2026-08-21 A 수정, E 통보)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "잠시 후 다시 시도해 주세요")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="hm hm--canvas">
      <div className="hm__col hm-auth">
        <div className="hm-card">
          <div className="hm-card__head">
            <h1 className="hm-card__title">로그인</h1>
          </div>
          <p className="hm__note">함께 걷는 하루에 다시 오신 걸 환영해요</p>

          <form className="hm-auth__form" onSubmit={onSubmit}>
            <div className="hm-field">
              <label className="hm-field__label" htmlFor="email">
                이메일
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="hm-field__input"
              />
            </div>

            <div className="hm-field">
              <label className="hm-field__label" htmlFor="password">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="hm-field__input"
              />
            </div>

            {/* role="alert"이 없으면 로그인 실패 사유가 스크린리더에 전달되지 않는다 —
                버튼만 다시 눌러보게 된다 */}
            {error && (
              <p role="alert" className="hm-field__help hm-field__help--error">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="hm-btn hm-card__cta">
              {submitting ? "로그인하고 있어요…" : "로그인"}
            </button>
          </form>

          <div className="hm-auth__divider" aria-hidden="true">
            또는
          </div>

          <a href="/api/auth/google" className="hm-btn hm-btn--ghost">
            Google로 계속하기
          </a>

          <p className="hm-auth__foot">
            계정이 없으신가요? <Link href="/signup" className="hm-link">가입하기</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
