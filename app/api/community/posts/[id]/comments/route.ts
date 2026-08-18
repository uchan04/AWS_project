import type { NextRequest } from "next/server"
import { getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { canAccessGallery } from "@/app/community/_lib/gallery"
import { grantAffinity, COMMENT_AFFINITY } from "@/app/community/_lib/affinity"

// 친밀도를 지급하는 라우트라 getCurrentUserWithSkin()을 쓴다(calculateReward에 activePetSkin이 필요).
export async function POST(request: NextRequest, ctx: RouteContext<"/api/community/posts/[id]/comments">) {
  try {
    const user = await getCurrentUserWithSkin()
    const { id } = await ctx.params

    const payload = await request.json().catch(() => null)
    const body = typeof payload?.body === "string" ? payload.body.trim() : ""
    if (!body) return fail("INVALID_BODY", "댓글 내용을 입력해주세요", 400)

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, galleryType: true },
    })
    if (!post) return fail("NOT_FOUND", "게시글을 찾을 수 없어요", 404)

    if (!canAccessGallery(post.galleryType, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리는 볼 수 없어요", 400)
    }

    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: { postId: post.id, userId: user.id, body },
        include: { user: { select: { nickname: true, typeCode: true } } },
      }),
      prisma.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } }),
    ])

    const granted = await grantAffinity(user, COMMENT_AFFINITY)

    return ok({ comment, granted })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
