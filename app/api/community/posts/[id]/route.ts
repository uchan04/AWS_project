import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { canAccessGallery } from "@/app/community/_lib/gallery"

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/community/posts/[id]">) {
  try {
    const user = await getCurrentUser()
    const { id } = await ctx.params

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { nickname: true, typeCode: true } },
        likes: { where: { userId: user.id }, select: { id: true } },
      },
    })
    if (!post) return fail("NOT_FOUND", "게시글을 찾을 수 없어요", 404)

    if (!canAccessGallery(post.galleryType, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리는 볼 수 없어요", 400)
    }

    const comments = await prisma.comment.findMany({
      where: { postId: post.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { nickname: true, typeCode: true } } },
    })

    return ok({
      post: {
        id: post.id,
        title: post.title,
        body: post.body,
        createdAt: post.createdAt,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        user: post.user,
        likedByMe: post.likes.length > 0,
        isOwn: post.userId === user.id,
      },
      comments,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}

// 본인 글만 삭제 가능. 소프트 삭제이며 친밀도는 회수하지 않는다(SPEC.md 8절 취지).
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/community/posts/[id]">) {
  try {
    const user = await getCurrentUser()
    const { id } = await ctx.params

    const post = await prisma.post.findUnique({ where: { id }, select: { userId: true, deletedAt: true } })
    if (!post) return fail("NOT_FOUND", "게시글을 찾을 수 없어요", 404)

    if (post.userId !== user.id) return fail("FORBIDDEN", "본인 글만 삭제할 수 있어요", 400)

    if (post.deletedAt) return fail("NOT_FOUND", "이미 삭제된 글이에요", 404)

    await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } })

    return ok({ id })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
