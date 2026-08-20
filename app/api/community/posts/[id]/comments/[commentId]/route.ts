import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"

// 본인 댓글만 삭제 가능. 소프트 삭제이며 친밀도는 회수하지 않는다(글 삭제와 동일한 이유).
// 친밀도를 건드리지 않으므로 activePetSkin이 필요 없어 getCurrentUser()를 쓴다.
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/community/posts/[id]/comments/[commentId]">,
) {
  try {
    const user = await getCurrentUser()
    const { id, commentId } = await ctx.params

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, postId: true, deletedAt: true },
    })
    if (!comment) return fail("NOT_FOUND", "댓글을 찾을 수 없어요", 404)

    // URL의 글과 댓글이 안 맞으면 엉뚱한 글의 commentCount를 깎게 된다.
    if (comment.postId !== id) return fail("NOT_FOUND", "댓글을 찾을 수 없어요", 404)

    if (comment.userId !== user.id) return fail("FORBIDDEN", "본인 댓글만 삭제할 수 있어요", 400)

    // 이 검사가 없으면 같은 댓글을 두 번 지울 때 commentCount가 음수가 된다.
    if (comment.deletedAt) return fail("NOT_FOUND", "이미 삭제된 댓글이에요", 404)

    await prisma.$transaction([
      prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
      prisma.post.update({ where: { id }, data: { commentCount: { decrement: 1 } } }),
    ])

    return ok({ id: commentId })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
