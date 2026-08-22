import type { NextRequest } from "next/server"
import { getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { canAccessGallery } from "@/app/community/_lib/gallery"
import { COMMENT_MAX } from "@/app/community/_lib/limits"
import { grantAffinity, COMMENT_AFFINITY } from "@/app/community/_lib/affinity"
import { recordAttempt, retryAfter } from "@/lib/ratelimit"

// 도배 방어. IP가 아니라 userId로 센다(app/api/community/posts/route.ts와 같은 이유).
// 댓글은 글보다 가볍게 여러 개 달아도 정상이라 상한을 넉넉히 둔다.
const COMMENT_LIMIT = 20
const COMMENT_WINDOW_MS = 10 * 60 * 1000

// 친밀도를 지급하는 라우트라 getCurrentUserWithSkin()을 쓴다(calculateReward에 activePetSkin이 필요).
export async function POST(request: NextRequest, ctx: RouteContext<"/api/community/posts/[id]/comments">) {
  try {
    const user = await getCurrentUserWithSkin()
    const { id } = await ctx.params

    const rateKey = `comment:${user.id}`
    const wait = retryAfter(rateKey, COMMENT_LIMIT)
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60)
      return fail("TOO_MANY_ATTEMPTS", `댓글을 너무 빠르게 쓰고 있어요. ${minutes}분 후에 다시 시도해 주세요`, 400)
    }

    const payload = await request.json().catch(() => null)
    const body = typeof payload?.body === "string" ? payload.body.trim() : ""
    if (!body) return fail("INVALID_BODY", "댓글 내용을 입력해주세요", 400)
    // 화면의 maxLength는 UX다. 신뢰 경계는 여기다
    if (body.length > COMMENT_MAX) {
      return fail("COMMENT_TOO_LONG", `댓글은 ${COMMENT_MAX}자까지 쓸 수 있어요`, 400)
    }

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, galleryType: true },
    })
    if (!post) return fail("NOT_FOUND", "게시글을 찾을 수 없어요", 404)

    if (!canAccessGallery(post.galleryType, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리는 볼 수 없어요", 400)
    }

    // 검증·권한을 통과한 요청만 센다
    recordAttempt(rateKey, COMMENT_WINDOW_MS)

    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: { postId: post.id, userId: user.id, body },
        include: { user: { select: { nickname: true, typeCode: true } } },
      }),
      prisma.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } }),
    ])

    const granted = await grantAffinity(user, COMMENT_AFFINITY)

    // 작성 직후 목록에 바로 붙는 구조라 GET 상세의 댓글 형태와 똑같이 맞춘다(userId 미노출 + isOwn).
    return ok({
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        user: comment.user,
        isOwn: true,
      },
      granted,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
