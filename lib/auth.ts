import type { PetSkin, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// 소유자: E. 모든 API Route Handler의 첫 줄에서 호출한다.
// 현재는 DEV_AUTH_BYPASS 스텁이다. 실제 Cognito 검증은 8/15 마감.

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요합니다")
  }
}

const DEV_COGNITO_SUB = "dev-user-000"

/** 미인증이면 UnauthorizedError를 throw한다. 호출부는 401로 변환한다. */
export async function getCurrentUser(): Promise<User> {
  if (process.env.DEV_AUTH_BYPASS === "true") {
    return prisma.user.upsert({
      where: { cognitoSub: DEV_COGNITO_SUB },
      update: {},
      create: { cognitoSub: DEV_COGNITO_SUB, nickname: "개발용 계정" },
    })
  }

  // TODO(E): aws-jwt-verify로 Cognito 액세스 토큰을 검증하고 sub으로 upsert한다.
  throw new UnauthorizedError()
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
