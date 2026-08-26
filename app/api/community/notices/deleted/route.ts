import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { pendingDeleteNotices, pendingDeleteWhere } from "@/app/community/_lib/deleteNotice"

/**
 * 관리자 삭제 통보. 모임 무산 알림(`meetups/notices`)과 같은 결이다 —
 * 새 모델 없이 대상 행의 타임스탬프(`deleteNotifiedAt`)로만 읽음을 표시한다.
 *
 * 조회 조건은 `_lib/deleteNotice.ts`의 `pendingDeleteWhere()` 한 곳에서 나온다.
 * GET과 POST가 같은 함수를 쓰는 것이 핵심이다 — 두 벌이 되면 한쪽만 고쳐졌을 때
 * 보여주지 않은 알림이 읽음으로 찍힌다.
 */

/** 본인의 미통보 삭제 건. 없으면 빈 배열이라 화면이 아무것도 그리지 않는다. */
export async function GET() {
  try {
    const user = await getCurrentUser()
    return ok({ notices: await pendingDeleteNotices(user.id) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}

/**
 * 문자열이 아닌 원소는 걸러낸다. 그대로 `in`에 넣으면 쿼리 단계에서 터진다
 * (`meetups/notices/route.ts`와 같은 이유).
 */
function stringIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id: unknown): id is string => typeof id === "string") : []
}

/**
 * 읽음 처리.
 *
 * `where`에 `userId: user.id`가 박혀 있어 본인 행만 갱신된다 — 남의 postId·commentId를
 * 섞어 보내도 그 사람의 알림은 건드려지지 않는다. `deletedByAdmin: true`와
 * `deleteNotifiedAt: null` 조건도 조회와 같은 것을 쓴다.
 *
 * 두 updateMany를 한 트랜잭션에 묶는다. 글만 읽음 처리되고 댓글이 실패하면 다음 접속 때
 * 댓글만 다시 뜨는데, 사용자는 방금 확인을 눌렀으므로 같은 팝업이 또 뜬 것으로 읽는다.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const payload = await request.json().catch(() => null)
    const postIds = stringIds(payload?.postIds)
    const commentIds = stringIds(payload?.commentIds)
    if (postIds.length === 0 && commentIds.length === 0) {
      return fail("INVALID_BODY", "확인할 알림이 없어요", 400)
    }

    const where = pendingDeleteWhere(user.id)
    // 한 번의 확인은 한 시각으로 남긴다. 호출마다 new Date()를 두 번 찍으면 글과 댓글이 갈린다.
    const notifiedAt = new Date()

    const [posts, comments] = await prisma.$transaction([
      prisma.post.updateMany({
        where: { ...where, id: { in: postIds } },
        data: { deleteNotifiedAt: notifiedAt },
      }),
      prisma.comment.updateMany({
        where: { ...where, id: { in: commentIds } },
        data: { deleteNotifiedAt: notifiedAt },
      }),
    ])

    return ok({ count: posts.count + comments.count })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
