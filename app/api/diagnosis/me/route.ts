// 소유자: A. 현재 로그인한 유저의 진단 결과. 결과 화면과 홈이 읽는다.
//
// 완료 API의 응답과 같은 모양을 돌려준다. 진단 전이면 data: null이다.
// 이 라우트가 있어서 결과 화면과 홈이 sessionStorage 없이 새로고침을 견딘다.
// subTypeCode와 지표는 여기서도 내보내지 않는다.

import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { fail, ok } from "@/lib/api"
import { TRIBE } from "@/lib/types"

export async function GET() {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }

  if (!user.typeCode || !user.adjective) return ok(null)

  const tribe = TRIBE[user.typeCode]
  return ok({
    typeCode: user.typeCode,
    adjective: user.adjective,
    nickname: user.nickname,
    animal: tribe.animal,
    colorHex: tribe.colorHex,
  })
}
