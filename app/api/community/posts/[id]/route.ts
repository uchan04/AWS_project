import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { canAccessGallery, postImageUrl } from "@/app/community/_lib/gallery"

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
        // 사진은 선택이라 대개 null이다. URL은 서버에서 붙인다(postImageUrl 주석 참고).
        imageKey: post.imageKey,
        imageUrl: postImageUrl(post.imageKey),
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        user: post.user,
        likedByMe: post.likes.length > 0,
        isOwn: post.userId === user.id,
      },
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        user: c.user,
        isOwn: c.userId === user.id,
      })),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}

// 본인 글 또는 관리자(User.isAdmin)만 삭제 가능. 소프트 삭제이며 친밀도는 회수하지 않는다
// (SPEC.md 8절 취지). **관리자 삭제도 본인 삭제와 동작이 같다** — 회수·미션 취소를 붙이면
// 남이 지웠다는 이유로 작성자의 재화가 사라진다. 관리자 판정은 meetups 라우트와 같은 방식이다.
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/community/posts/[id]">) {
  try {
    const user = await getCurrentUser()
    const { id } = await ctx.params

    const post = await prisma.post.findUnique({ where: { id }, select: { userId: true, deletedAt: true } })
    if (!post) return fail("NOT_FOUND", "게시글을 찾을 수 없어요", 404)

    if (post.userId !== user.id && !user.isAdmin) {
      return fail("FORBIDDEN", "본인 글만 삭제할 수 있어요", 400)
    }

    if (post.deletedAt) return fail("NOT_FOUND", "이미 삭제된 글이에요", 404)

    await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } })

    return ok({ id })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
