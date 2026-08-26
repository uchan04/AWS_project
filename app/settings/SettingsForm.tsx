"use client"

// 소유자: A. /settings의 입력부. 비밀번호 변경 폼과 탈퇴 2단 확인.
//
// 탈퇴는 한 번 누르면 끝나지 않게 두 단계로 나눴다. 무엇이 지워지는지 먼저 보여주고,
// 그다음에 비밀번호(또는 "탈퇴" 입력)를 받는다. 되돌릴 수 없는 동작이라 확인 없이 두지 않는다.

import Link from "next/link"
import { useState } from "react"
import type { TypeCode } from "@prisma/client"
import { NICKNAME_MAX, isValidNickname } from "@/lib/types"
import "@/styles/tokens.css"

type ApiBody = { data?: unknown; error?: { code: string; message: string } }

async function post(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const parsed: ApiBody = await response.json().catch(() => ({}))
  if (!response.ok || parsed.error) {
    throw new Error(parsed.error?.message ?? "잠시 후 다시 시도해 주세요")
  }
}

const PASSWORD_MIN = 8

export default function SettingsForm({
  email,
  hasPassword,
  nickname,
  typeCode,
}: {
  email: string | null
  hasPassword: boolean
  nickname: string
  typeCode: TypeCode | null
}) {
  const [currentNickname, setCurrentNickname] = useState(nickname)
  const [nickSubmitting, setNickSubmitting] = useState(false)
  const [nickError, setNickError] = useState<string | null>(null)
  const [nickDone, setNickDone] = useState(false)
  const nickValid = isValidNickname(currentNickname)

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  const [confirming, setConfirming] = useState(false)
  const [withdrawInput, setWithdrawInput] = useState("")
  const [wdSubmitting, setWdSubmitting] = useState(false)
  const [wdError, setWdError] = useState<string | null>(null)

  async function onChangeNickname(event: React.FormEvent) {
    event.preventDefault()
    if (!nickValid || currentNickname === nickname) return
    setNickSubmitting(true)
    setNickError(null)
    setNickDone(false)
    try {
      const response = await fetch("/api/diagnosis/nickname", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: currentNickname }),
      })
      const parsed = await response.json().catch(() => ({}))
      if (!response.ok || parsed?.error) {
        throw new Error(parsed?.error?.message ?? "잠시 후 다시 시도해 주세요")
      }
      setNickDone(true)
    } catch (caught) {
      setNickError(caught instanceof Error ? caught.message : "잠시 후 다시 시도해 주세요")
    } finally {
      setNickSubmitting(false)
    }
  }

  async function onChangePassword(event: React.FormEvent) {
    event.preventDefault()
    setPwSubmitting(true)
    setPwError(null)
    setPwDone(false)
    try {
      await post("/api/auth/password", { currentPassword: current, newPassword: next })
      setCurrent("")
      setNext("")
      setPwDone(true)
    } catch (caught) {
      setPwError(caught instanceof Error ? caught.message : "잠시 후 다시 시도해 주세요")
    } finally {
      setPwSubmitting(false)
    }
  }

  async function onWithdraw(event: React.FormEvent) {
    event.preventDefault()
    setWdSubmitting(true)
    setWdError(null)
    try {
      await post("/api/auth/withdraw", hasPassword ? { password: withdrawInput } : { confirm: withdrawInput })
      // 로그아웃과 같은 이유로 전체 새로고침이다. router.push는 RSC 캐시를 남겨
      // 계정이 사라진 뒤에도 사이드바가 방금 지운 사람의 닉네임·재화를 그린다
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login"
    } catch (caught) {
      setWdError(caught instanceof Error ? caught.message : "잠시 후 다시 시도해 주세요")
      setWdSubmitting(false)
    }
  }

  return (
    <main className="hm hm--canvas" data-tribe={typeCode ?? undefined}>
      <div className="hm__col hm-auth">
        <div className="hm-card">
          <div className="hm-card__head">
            <h1 className="hm-card__title">계정 설정</h1>
          </div>
          <p className="hm__note">
            로그인 정보: {email ?? "이메일 없음"}
            {hasPassword ? " (이메일·비밀번호)" : " (Google)"}
          </p>
        </div>

        <div className="hm-card">
          <div className="hm-card__head">
            <h2 className="hm-card__title">이름 바꾸기</h2>
          </div>
          <form className="hm-auth__form" onSubmit={onChangeNickname}>
            <div className="hm-field">
              <label className="hm-field__label" htmlFor="nickname">
                새 이름
              </label>
              <input
                id="nickname"
                type="text"
                required
                maxLength={NICKNAME_MAX}
                value={currentNickname}
                onChange={(event) => setCurrentNickname(event.target.value)}
                className="hm-field__input"
                aria-describedby="nickname-help"
              />
              <p className="hm-field__help" id="nickname-help">
                2~12자로 정해 주세요.
              </p>
            </div>

            {nickError && (
              <p role="alert" className="hm-field__help hm-field__help--error">
                {nickError}
              </p>
            )}
            {nickDone && (
              <p role="status" className="hm-field__help">
                이름을 바꿨어요.
              </p>
            )}

            <button
              type="submit"
              disabled={nickSubmitting || !nickValid || currentNickname === nickname}
              className="hm-btn hm-card__cta"
              aria-disabled={nickSubmitting || !nickValid || currentNickname === nickname}
            >
              {nickSubmitting ? "바꾸고 있어요…" : "이름 바꾸기"}
            </button>
          </form>
        </div>

        <div className="hm-card">
          <div className="hm-card__head">
            <h2 className="hm-card__title">비밀번호 변경</h2>
          </div>

          {!hasPassword ? (
            <p className="hm__note">
              Google로 로그인한 계정이라 이 서비스에 비밀번호가 없어요. 비밀번호는 Google 계정에서
              관리해 주세요.
            </p>
          ) : (
            <form className="hm-auth__form" onSubmit={onChangePassword}>
              <div className="hm-field">
                <label className="hm-field__label" htmlFor="current-password">
                  현재 비밀번호
                </label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  className="hm-field__input"
                />
              </div>

              <div className="hm-field">
                <label className="hm-field__label" htmlFor="new-password">
                  새 비밀번호
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN}
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  className="hm-field__input"
                  aria-describedby="new-password-help"
                />
                <p className="hm-field__help" id="new-password-help">
                  {PASSWORD_MIN}자 이상으로 정해 주세요.
                </p>
              </div>

              {pwError && (
                <p role="alert" className="hm-field__help hm-field__help--error">
                  {pwError}
                </p>
              )}
              {pwDone && (
                <p role="status" className="hm-field__help">
                  비밀번호를 바꿨어요. 다른 기기에 로그인해 둔 화면은 최대 7일 뒤에 풀려요.
                </p>
              )}

              <button
                type="submit"
                disabled={pwSubmitting}
                className="hm-btn hm-card__cta"
                aria-disabled={pwSubmitting}
                style={{ backgroundColor: typeCode ? "var(--tribe)" : undefined, borderColor: typeCode ? "var(--tribe)" : undefined }}
              >
                {pwSubmitting ? "바꾸고 있어요…" : "비밀번호 바꾸기"}
              </button>
            </form>
          )}
        </div>

        <div className="hm-card">
          <div className="hm-card__head">
            <h2 className="hm-card__title">회원 탈퇴</h2>
          </div>

          {!confirming ? (
            <>
              <p className="hm__note">
                계정을 지우면 되돌릴 수 없어요. 레벨과 씨앗, 키우던 아이, 쓴 글과 댓글도 함께
                지워집니다.
              </p>
              <button
                type="button"
                className="hm-btn hm-btn--danger hm-card__cta"
                onClick={() => setConfirming(true)}
              >
                탈퇴하기
              </button>
            </>
          ) : (
            <form className="hm-auth__form" onSubmit={onWithdraw}>
              <p className="hm__note">
                {hasPassword
                  ? "확인을 위해 비밀번호를 한 번 더 입력해 주세요."
                  : '확인을 위해 "탈퇴"를 입력해 주세요.'}
              </p>
              <div className="hm-field">
                <label className="hm-field__label" htmlFor="withdraw-confirm">
                  {hasPassword ? "비밀번호" : '"탈퇴" 입력'}
                </label>
                <input
                  id="withdraw-confirm"
                  type={hasPassword ? "password" : "text"}
                  autoComplete={hasPassword ? "current-password" : "off"}
                  required
                  value={withdrawInput}
                  onChange={(event) => setWithdrawInput(event.target.value)}
                  className="hm-field__input"
                />
              </div>

              {wdError && (
                <p role="alert" className="hm-field__help hm-field__help--error">
                  {wdError}
                </p>
              )}

              <button
                type="submit"
                disabled={wdSubmitting}
                className="hm-btn hm-btn--danger hm-card__cta"
                aria-disabled={wdSubmitting}
              >
                {wdSubmitting ? "지우고 있어요…" : "계정을 영구히 지웁니다"}
              </button>
              <button
                type="button"
                className="hm-btn hm-btn--ghost"
                onClick={() => {
                  setConfirming(false)
                  setWithdrawInput("")
                  setWdError(null)
                }}
              >
                그만두기
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
