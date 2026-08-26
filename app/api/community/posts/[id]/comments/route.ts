import type { NextRequest } from "next/server"
import { getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { canAccessGallery } from "@/app/community/_lib/gallery"
import { COMMENT_MAX } from "@/app/community/_lib/limits"
import { grantAffinity, COMMENT_AFFINITY } from "@/app/community/_lib/affinity"
import { recordAttempt, retryAfter } from "@/lib/ratelimit"
import { containsAbuse, isCrisis, CRISIS_POST_NOTICE } from "@/lib/safety"
import { blocksPosting, crisisBlockedPayload } from "@/app/community/_lib/crisis"
import { moderate, BLOCK_CODE } from "@/app/community/_lib/moderation"
import { invokeBedrock } from "@/app/community/_lib/bedrock"

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

    // 글 작성과 같은 판정이다. 관리자는 모든 종족 갤러리에 댓글을 단다 —
    // 자기 공지에 답글을 못 다는 상태가 되면 안 된다.
    if (!canAccessGallery(post.galleryType, user.typeCode, user.isAdmin)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리는 볼 수 없어요", 400)
    }

    // 검증·권한을 통과한 요청만 센다
    recordAttempt(rateKey, COMMENT_WINDOW_MS)

    // 댓글은 대상이 있는 글이라 공격이 나올 자리가 글보다 많다.
    // 판정 기준과 이유는 lib/safety.ts와 posts/route.ts의 같은 블록 주석에 있다.
    // ── 위기 신호를 **모든 차단보다 먼저** 본다 (2026-08-26, 차단 31번 해소) ──
    //
    // 전에는 containsAbuse() 뒤에 있었다. 그래서 위기 신호와 타인 공격이 함께 있는 글이
    // 도움 안내 없이 400을 받았다 — 실측:
    //   "너 병신이냐 나는 죽고 싶다"          abuse=T crisis=T blocks=T → 400 ABUSIVE_CONTENT
    //   "너 같은 새끼 때문에 죽고 싶다"        abuse=T crisis=T blocks=T → 400
    // 차단 30번(moderate 앞으로 옮긴 것)과 **같은 모양의 역전이 이 관문에 남아 있었다.**
    //
    // **우회가 열리지 않는다.** blocksPosting()은 글을 저장하지 않는다 — 공격 글에
    // "죽고 싶다"를 덧붙여도 게시되지 않고, 달라지는 것은 응답뿐이다(400 + "표현을 고쳐주세요"
    // → 200 + 도움 안내). 공격을 통과시키는 분기가 아니므로 D가 우려한 우회와 무관하다.
    if (blocksPosting(body)) {
      return ok(crisisBlockedPayload())
    }

    if (containsAbuse(body)) {
      return fail("ABUSIVE_CONTENT", "다른 사람을 향한 말이 담겨 있어요. 표현을 고쳐서 다시 올려주세요", 400)
    }

    // 글과 같은 2단 검열이다. 근거는 app/api/community/posts/route.ts의 같은 블록 주석에 있다.
    // 던지지 않으므로(fail-open) 따로 감싸지 않는다. BLOCK만 막고 WARN·SELF는 통과시킨다.
    //
    // 위기 신호는 저장하지 않고 안내만 돌려준다. 검열보다 먼저 본다(글 라우트와 같은 사안).
    // 결정 변경의 근거와 톤 규칙은 app/community/_lib/crisis.ts 주석에 있다.
    // 글 라우트와 같은 기준이다. isCrisis()가 아니라 blocksPosting()으로 막는다 —
    // 이유는 그쪽 주석과 _lib/crisis.ts에 있다.

    const mod = await moderate(body, invokeBedrock)
    if (mod.verdict === "BLOCK") {
      return fail(BLOCK_CODE, mod.message, 400)
    }

    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: { postId: post.id, userId: user.id, body },
        // isAdmin은 작성자 표기용이다(_lib/author.ts). 필드를 더 늘리지 마라
        include: { user: { select: { nickname: true, typeCode: true, isAdmin: true } } },
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
      // 막지 않은 위기 신호(사별·보도·비유 등)에는 안내만 얹는다. 댓글은 실제로 달렸다
      crisisNotice: isCrisis(body) ? CRISIS_POST_NOTICE : null,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
