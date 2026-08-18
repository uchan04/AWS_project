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
      },
      comments,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
