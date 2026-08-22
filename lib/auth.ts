import { randomUUID } from "node:crypto"
import type { PetSkin, User } from "@prisma/client"
import { cookies } from "next/headers"
import { CognitoJwtVerifier } from "aws-jwt-verify"
import { prisma } from "@/lib/prisma"
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, readSessionToken } from "@/lib/session"

// 소유자: E. 모든 API Route Handler의 첫 줄에서 호출한다.
// 로그인(app/api/auth/*)이 Cognito 액세스 토큰을 `access_token` httpOnly 쿠키에 담아 두고,
// 여기서는 그 쿠키만 읽는다. Authorization 헤더는 문서 내비게이션(링크 클릭, 주소창 이동)에
// 붙지 않아 서버 컴포넌트 페이지를 인증할 수 없어서 쓰지 않는다.

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요합니다")
  }
}

const DEV_COGNITO_SUB = "local:team-test"

/**
 * 자체 DB 계정의 cognitoSub. cognitoSub는 NOT NULL·유니크인데 자체 계정에는 Cognito sub가 없다.
 * Cognito sub는 UNIQUE 제약을 만족시켜야 하므로 계정마다 다른 값이 필요하고, Cognito가 만든
 * sub(UUID)와 절대 겹치지 않아야 한다. 접두사를 붙여 두 조건을 동시에 만족시킨다.
 */
export function localCognitoSub() {
  return `local:${randomUUID()}`
}

// DEV_AUTH_BYPASS=true인 로컬 개발 환경은 COGNITO_USER_POOL_ID를 설정할 필요가 없다.
// 모듈 로드 시점에 CognitoJwtVerifier.create()를 부르면 빈 Pool ID로 즉시 throw해서
// API 라우트를 가진 사람 전원의 `npm run build`가 깨진다. 실제로 검증이 필요한 시점에만 만든다.
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID ?? "",
      tokenUse: "access",
      clientId: process.env.COGNITO_CLIENT_ID ?? "",
    })
  }
  return verifier
}

/** 미인증이면 UnauthorizedError를 throw한다. 호출부는 401로 변환한다. */
export async function getCurrentUser(): Promise<User> {
  if (process.env.DEV_AUTH_BYPASS === "true") {
    return prisma.user.upsert({
      where: { cognitoSub: DEV_COGNITO_SUB },
      update: {},
      create: { cognitoSub: DEV_COGNITO_SUB, nickname: "Welli 팀" },
    })
  }

  const jar = await cookies()

  // 자체 계정 세션(A 추가, 2026-08-21). Cognito 쿠키와 이름이 달라 섞이지 않는다.
  // 쿠키가 있는데 서명이 깨졌거나 만료됐으면 Cognito 경로로 흘려보내지 않고 바로 401이다 —
  // 흘려보내면 만료된 세션이 "쿠키 없음"과 구분되지 않아 원인을 못 찾는다.
  const session = jar.get(SESSION_COOKIE)?.value
  if (session) {
    const userId = readSessionToken(session)
    if (!userId) throw new UnauthorizedError()
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedError()
    return user
  }

  // 2026-08-22 이전에 발급된 Cognito 쿠키를 위한 경로. 새 로그인은 위의 세션 쿠키만 심는다.
  // 이 쿠키는 1시간이면 만료되므로 남아 있는 것도 곧 사라진다.
  const token = jar.get("access_token")?.value ?? null
  if (!token) throw new UnauthorizedError()

  const user = await userFromCognitoToken(token)
  if (!user) throw new UnauthorizedError()
  return user
}

/** Cognito 액세스 토큰 → 우리 계정. 없으면 만든다. 토큰이 유효하지 않으면 null */
async function userFromCognitoToken(accessToken: string): Promise<User | null> {
  try {
    const payload = await getVerifier().verify(accessToken)
    return await prisma.user.upsert({
      where: { cognitoSub: payload.sub },
      update: {},
      create: { cognitoSub: payload.sub },
    })
  } catch {
    return null
  }
}

/**
 * Cognito로 인증한 직후(이메일 로그인 폴백·Google 콜백) 세션을 심는다. 실패하면 null.
 *
 * Cognito 액세스 토큰을 쿠키에 그대로 담지 않는다(A, 2026-08-22). 그 토큰은 1시간이면
 * 만료되고 refresh 흐름이 없어서 Google로 들어온 사용자만 한 시간 뒤 조용히 로그아웃됐다.
 * 여기서 자체 세션 쿠키(7일)로 바꿔 자체 계정과 수명을 맞춘다.
 */
export async function signInWithCognitoToken(accessToken: string): Promise<User | null> {
  const user = await userFromCognitoToken(accessToken)
  if (!user) return null
  await setLocalSessionCookie(user.id)
  return user
}

/**
 * 재화를 지급하는 API는 이 버전을 쓴다.
 * calculateReward()에 넘길 활성 스킨을 같이 가져오기 위한 것이다.
 */
export async function getCurrentUserWithSkin(): Promise<User & { activePetSkin: PetSkin | null }> {
  const user = await getCurrentUser()
  const full = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { activePetSkin: true },
  })
  return full
}

/**
 * 자체 계정 로그인이 심는 쿠키. Cognito 토큰이 아니라 서명된 userId라 검증에 네트워크가 없다.
 * 만료는 lib/session.ts가 토큰 안에 박아두므로 쿠키 maxAge와 같은 값을 쓴다.
 */
export async function setLocalSessionCookie(userId: string) {
  ;(await cookies()).set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete("access_token")
  // 두 쿠키 중 어느 쪽으로 들어왔는지 로그아웃 시점에는 알 필요가 없다. 둘 다 지운다
  jar.delete(SESSION_COOKIE)
}
