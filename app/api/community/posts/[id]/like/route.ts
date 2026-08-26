import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { canAccessGallery } from "@/app/community/_lib/gallery"

// 좋아요에는 친밀도 지급이 없다(SPEC.md 8절). 재화를 건드리지 않으므로 getCurrentUser로 충분하다.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/community/posts/[id]/like">) {
  try {
    const user = await getCurrentUser()
    const { id } = await ctx.params

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, galleryType: true },
    })
    if (!post) return fail("NOT_FOUND", "게시글을 찾을 수 없어요", 404)

    // 글·댓글과 같은 판정이다.
    if (!canAccessGallery(post.galleryType, user.typeCode, user.isAdmin)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리는 볼 수 없어요", 400)
    }

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId: post.id, userId: user.id } },
    })

    if (existing) {
      const [, updatedPost] = await prisma.$transaction([
        prisma.postLike.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id: post.id }, data: { likeCount: { decrement: 1 } } }),
      ])
      return ok({ liked: false, likeCount: updatedPost.likeCount })
    }

    try {
      const [, updatedPost] = await prisma.$transaction([
        prisma.postLike.create({ data: { postId: post.id, userId: user.id } }),
        prisma.post.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } }),
      ])
      return ok({ liked: true, likeCount: updatedPost.likeCount })
    } catch (error) {
      // @@unique([postId, userId]) — 동시 클릭으로 이미 좋아요가 눌린 경우. 현재 값을 그대로 돌려준다.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const current = await prisma.post.findUniqueOrThrow({
          where: { id: post.id },
          select: { likeCount: true },
        })
        return ok({ liked: true, likeCount: current.likeCount })
      }
      throw error
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
