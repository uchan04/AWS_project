import { createHmac, timingSafeEqual } from "node:crypto"

// 소유자: A. 자체 DB 계정의 세션 토큰. Google 로그인은 Cognito 액세스 토큰을 그대로 쓴다.
//
// DB에 세션 표를 만들지 않는다. 토큰 자체에 유저 id와 만료를 담고 서명해서,
// 읽을 때 서명만 확인한다. 스키마 변경이 한 번 줄고 조회도 없다.
// 대신 즉시 무효화(강제 로그아웃)는 안 된다 — 만료 전까지 유효하다.
//
// 형식: <userId>.<만료 epoch 초>.<HMAC-SHA256 base64url>
// 서명이 없으면 쿠키 값을 손으로 바꿔 아무 계정으로나 로그인된다. 서명은 선택이 아니다.

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export const SESSION_COOKIE = "session"
export const SESSION_MAX_AGE = MAX_AGE_SECONDS

/**
 * 키가 없으면 즉시 throw한다. 빈 문자열로 서명하면 누구나 같은 서명을 만들 수 있어서,
 * 조용히 동작하는 것이 조용히 뚫린 것과 같다.
 */
function secret(): string {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error("SESSION_SECRET이 설정되지 않았습니다")
  return value
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function createSessionToken(userId: string, now: number = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + MAX_AGE_SECONDS
  const payload = `${userId}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

/** 유효하면 userId, 아니면 null. 서명 확인을 만료 확인보다 먼저 한다. */
export function readSessionToken(token: string, now: number = Date.now()): string | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [userId, expiresAt, signature] = parts
  if (!userId || !/^\d+$/.test(expiresAt)) return null

  const expected = Buffer.from(sign(`${userId}.${expiresAt}`))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  if (Number(expiresAt) * 1000 <= now) return null
  return userId
}
