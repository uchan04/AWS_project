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
      router.push("/")
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
          <p className="hm__note">모꼬지에 다시 오신 걸 환영해요</p>

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

            {error && <p className="hm-field__help hm-field__help--error">{error}</p>}

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
