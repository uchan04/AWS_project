// 소유자: A. 회원 탈퇴. 계정과 그 계정이 만든 데이터를 실제로 지운다.
//
// 소프트 삭제(deletedAt)를 쓰지 않는 이유: 탈퇴는 "개인정보를 지워 달라"는 요청이라
// 행을 남기면 이메일과 비밀번호 해시가 그대로 남는다. 글을 익명으로 남기는 방식도
// 흔하지만 그러려면 "알 수 없음" 표시 유저를 따로 둬야 해서 이번엔 함께 지운다.
// 화면에서 "쓴 글과 댓글도 모두 지워집니다"라고 먼저 알린다.
//
// prisma/schema.prisma에 onDelete: Cascade가 없어서(전원 합의 파일이라 A가 못 고친다)
// 자식 행을 순서대로 직접 지운다. 순서를 틀리면 FK 위반으로 500이 난다.

import { fail, ok } from "@/lib/api"
import { UnauthorizedError, clearSessionCookie, getCurrentUser } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"

/** 비밀번호가 없는 계정(Google)은 이 글자를 그대로 입력해야 지운다. */
const CONFIRM_WORD = "탈퇴"

export async function POST(request: Request) {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail("INVALID_BODY", "요청 형식이 올바르지 않습니다", 400)
  }
  const { password, confirm } = (body as { password?: unknown; confirm?: unknown }) ?? {}

  // 열린 화면을 지나가다 누르는 것과 CSRF를 함께 막는다. 세션 쿠키만으로는 지우지 않는다
  if (user.passwordHash) {
    if (typeof password !== "string" || !verifyPassword(password, user.passwordHash)) {
      return fail("INVALID_CREDENTIALS", "비밀번호가 올바르지 않습니다", 401)
    }
  } else if (confirm !== CONFIRM_WORD) {
    return fail("CONFIRM_REQUIRED", `계속하려면 "${CONFIRM_WORD}"를 입력해 주세요`, 400)
  }

  const userId = user.id

  await prisma.$transaction([
    // 내 글에 달린 남의 댓글·좋아요까지 먼저 지운다. 남기면 Post 삭제가 FK로 막힌다
    prisma.comment.deleteMany({ where: { OR: [{ userId }, { post: { userId } }] } }),
    prisma.postLike.deleteMany({ where: { OR: [{ userId }, { post: { userId } }] } }),
    prisma.post.deleteMany({ where: { userId } }),
    prisma.chatMessage.deleteMany({ where: { userId } }),
    prisma.attendanceClaim.deleteMany({ where: { userId } }),
    prisma.userMission.deleteMany({ where: { userId } }),
    prisma.userPetSkin.deleteMany({ where: { userId } }),
    prisma.userCosmetic.deleteMany({ where: { userId } }),
    prisma.diagnosisSession.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ])

  // Cognito 사용자 풀 쪽은 지우지 않는다. AdminDeleteUser에 필요한 IAM 권한이 배포 환경에
  // 없고(welli-diagnose 키에도 없다), 자체 DB 행이 사라지면 그 sub으로 로그인해도
  // getCurrentUser()가 새 계정을 만들 뿐 옛 데이터로는 못 돌아간다.
  await clearSessionCookie()
  return ok({})
}
