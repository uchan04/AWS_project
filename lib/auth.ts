import type { PetSkin, User } from "@prisma/client"
import { headers } from "next/headers"
import { CognitoJwtVerifier } from "aws-jwt-verify"
import { prisma } from "@/lib/prisma"

// 소유자: E. 모든 API Route Handler의 첫 줄에서 호출한다.
// 클라이언트는 Cognito 액세스 토큰을 `Authorization: Bearer <token>` 헤더로 보낸다.

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요합니다")
  }
}

const DEV_COGNITO_SUB = "dev-user-000"

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
      create: { cognitoSub: DEV_COGNITO_SUB, nickname: "개발용 계정" },
    })
  }

  const authHeader = (await headers()).get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) throw new UnauthorizedError()

  try {
    const payload = await getVerifier().verify(token)
    return prisma.user.upsert({
      where: { cognitoSub: payload.sub },
      update: {},
      create: { cognitoSub: payload.sub },
    })
  } catch {
    throw new UnauthorizedError()
  }
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
