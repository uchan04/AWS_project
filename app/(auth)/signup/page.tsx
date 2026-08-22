"use client"

// 소유자: E. 가입 화면. 인증 메일·코드는 보내지 않는다(CLAUDE.md 8절) — 가입하면 바로 로그인된다.
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Conversational FAQ.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import "@/styles/tokens.css"
import { signup } from "../api"

const PASSWORD_MIN = 8

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordTooShort = touched && password.length > 0 && password.length < PASSWORD_MIN

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signup(email, password)
      router.push("/")
      // 서버 레이아웃이 새 세션 쿠키를 읽도록 강제한다(login/page.tsx와 같은 이유)
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
            <h1 className="hm-card__title">가입하기</h1>
          </div>
          <p className="hm__note">이메일과 비밀번호만 있으면 바로 시작할 수 있어요</p>

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
              <div className="hm-field__box">
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setTouched(true)}
                  aria-invalid={passwordTooShort}
                  aria-describedby="password-help"
                  className="hm-field__input"
                />
                {passwordTooShort && (
                  <span className="hm-field__glyph" aria-hidden="true">
                    !
                  </span>
                )}
              </div>
              <p
                id="password-help"
                className={`hm-field__help${passwordTooShort ? " hm-field__help--error" : ""}`}
              >
                {passwordTooShort ? `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요` : ""}
              </p>
            </div>

            {/* 가입 실패 사유(이미 있는 이메일 등)를 스크린리더가 읽게 한다 */}
            {error && (
              <p role="alert" className="hm-field__help hm-field__help--error">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="hm-btn hm-card__cta">
              {submitting ? "가입하고 있어요…" : "가입하기"}
            </button>
          </form>

          <div className="hm-auth__divider" aria-hidden="true">
            또는
          </div>

          <a href="/api/auth/google" className="hm-btn hm-btn--ghost">
            Google로 계속하기
          </a>

          <p className="hm-auth__foot">
            이미 계정이 있으신가요? <Link href="/login" className="hm-link">로그인</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
