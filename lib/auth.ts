import { randomUUID } from "node:crypto"
import { cache } from "react"
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
    // 빈 Pool ID면 create()가 throw한다. 아래 verify() 호출은 try 안에 있어서 그 throw가
    // 토큰 만료와 똑같이 401로 뭉개졌다 — 환경변수가 런타임에 안 실린 배포에서 "로그인은
    // 되는데 모든 API가 401"로만 보이고 원인을 못 찾았다(2026-08-23). 여기서 먼저 끊는다.
    const userPoolId = process.env.COGNITO_USER_POOL_ID
    const clientId = process.env.COGNITO_CLIENT_ID
    if (!userPoolId || !clientId) {
      throw new Error(
        "COGNITO_USER_POOL_ID 또는 COGNITO_CLIENT_ID가 런타임에 없다. " +
          "amplify.yml이 .env.production으로 구워 넣는지 확인한다"
      )
    }
    verifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: "access", clientId })
  }
  return verifier
}

// 아래 두 함수를 React cache()로 감싼다(A, 2026-08-22). 요청 1건 안에서 몇 번을 불러도
// DB 쿼리는 한 번이다.
//
// 왜 필요한가: 루트 레이아웃이 사이드바를 그리려고 getSidebarProfile()을 부르고
// (→ getCurrentUserWithSkin), 같은 요청에서 페이지가 또 한 번 사용자를 읽는다.
// Amplify와 RDS가 us-east-1이고 한국에서 왕복 1회가 178ms라(docs/dev/diagnosis.md 실측)
// 중복 쿼리가 그대로 체감 지연이 된다.
//
// 실측(2026-08-22, 두 함수에 임시 console.log를 넣고 로컬에서 문서 요청 1건씩):
//   /pet  쿼리 8회 → 2회
//   /     쿼리 4회 → 2회
// 남는 2회는 세션 쿠키로 사용자를 읽는 것과 활성 스킨을 붙여 다시 읽는 것이다.
//
// 안전한 이유: 요청 1건 안에서 사용자를 고친 뒤 다시 읽는 핸들러가 없다 —
// 전부 처음에 한 번 읽어 그 객체를 넘긴다(2026-08-22 전수 확인).
// 새 핸들러를 쓸 때 "고친 뒤 다시 읽어 응답을 만드는" 코드를 넣으면 낡은 값을 보게 된다.
// 그때는 다시 읽지 말고 update의 반환값을 쓴다.
// cache()는 throw도 기억한다. 그래서 로그인 라우트는 getCurrentUser()를 부르지 않는다 —
// 쿠키를 심기 전에 한 번 부르면 그 요청 내내 미인증으로 남는다.

/** 미인증이면 UnauthorizedError를 throw한다. 호출부는 401로 변환한다. */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<User> {
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
})

/**
 * Cognito 액세스 토큰 → 우리 계정. 없으면 만든다. 토큰이 유효하지 않으면 null.
 *
 * getVerifier()를 try 밖에서 부른다(E, 2026-08-24). 안에 두면 환경변수 누락으로 인한
 * throw가 토큰 만료와 똑같이 null → 401로 뭉개져, "로그인은 되는데 모든 API가 401"만
 * 보이고 원인을 못 찾는다. 설정 오류는 500으로 터져야 CloudWatch에 원인이 남는다.
 */
async function userFromCognitoToken(accessToken: string): Promise<User | null> {
  const jwt = getVerifier()

  let sub: string
  try {
    // 여기서 throw하는 건 토큰이 만료·위조·다른 풀 발급인 경우뿐이다
    sub = (await jwt.verify(accessToken)).sub
  } catch {
    return null
  }

  return prisma.user.upsert({
    where: { cognitoSub: sub },
    update: {},
    create: { cognitoSub: sub },
  })
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
 *
 * 유저 행을 다시 읽지 않는다(2026-08-23, 실측 근거 아래). 전에는 getCurrentUser()가 읽어 온
 * 같은 행을 include와 함께 한 번 더 읽었다. Prisma는 to-one 관계도 기본적으로 쿼리를 따로
 * 내므로 그 한 줄이 왕복 2회였고, 합쳐서 3회가 됐다.
 *
 * activePetSkinId는 User의 컬럼이라(prisma/schema.prisma:113) 이미 손에 있다. 스킨만
 * 따로 읽으면 왕복 1회로 끝나고, 진단 전 유저(스킨 없음)는 0회다.
 *
 * 실측(prod 빌드, RDS us-east-1, 왕복 1회 = 180ms):
 *   이전  findUnique → findUnique(include)   536ms (3왕복)
 *   이후  findUnique → petSkin.findUnique    357ms (2왕복)
 * 루트 레이아웃이 사이드바를 그리려고 매 페이지에서 이걸 부르므로(lib/profile.ts)
 * 모든 화면의 TTFB에서 180ms가 빠진다.
 *
 * 반환 형태는 include 버전과 같다. 스킨 id가 지워진 행을 가리키면 include도 null을 줬다.
 */
export const getCurrentUserWithSkin = cache(async function getCurrentUserWithSkin(): Promise<
  User & { activePetSkin: PetSkin | null }
> {
  const user = await getCurrentUser()
  if (!user.activePetSkinId) return { ...user, activePetSkin: null }

  const activePetSkin = await prisma.petSkin.findUnique({ where: { id: user.activePetSkinId } })
  return { ...user, activePetSkin }
})

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
