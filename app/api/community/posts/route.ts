import type { NextRequest } from "next/server"
import { getCurrentUser, getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { GalleryType } from "@prisma/client"
import { resolveGallery, canAccessGallery, listGalleryPosts } from "@/app/community/_lib/gallery"
import { TITLE_MAX, BODY_MAX } from "@/app/community/_lib/limits"
import { grantAffinity, POST_AFFINITY } from "@/app/community/_lib/affinity"
import { completeMissionByCode } from "@/lib/missions/completion"
import { recordAttempt, retryAfter } from "@/lib/ratelimit"

// 도배 방어. 로그인 라우트는 IP로 세지만(clientKey) 여기는 인증된 뒤라 userId로 센다 —
// IP는 위조되고 공유 회선이면 남까지 막힌다. 글은 한 번 쓰는 데 몇 분이 걸리는 행동이라
// 10분에 5건이면 정상 사용자가 닿지 않는다.
const POST_LIMIT = 5
const POST_WINDOW_MS = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const tab = request.nextUrl.searchParams.get("tab") ?? undefined
    const gallery = resolveGallery(tab, user.typeCode)

    if (!canAccessGallery(gallery, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리는 볼 수 없어요", 400)
    }

    const posts = await listGalleryPosts(gallery)
    return ok({ gallery, posts })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}

// 친밀도를 지급하는 라우트라 getCurrentUserWithSkin()을 쓴다(calculateReward에 activePetSkin이 필요).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserWithSkin()

    const rateKey = `post:${user.id}`
    const wait = retryAfter(rateKey, POST_LIMIT)
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60)
      return fail("TOO_MANY_ATTEMPTS", `글을 너무 빠르게 올리고 있어요. ${minutes}분 후에 다시 시도해 주세요`, 400)
    }

    const payload = await request.json().catch(() => null)
    const title = typeof payload?.title === "string" ? payload.title.trim() : ""
    const body = typeof payload?.body === "string" ? payload.body.trim() : ""
    const requested = typeof payload?.galleryType === "string" ? payload.galleryType : GalleryType.ALL

    if (!title || !body) return fail("INVALID_BODY", "제목과 본문을 입력해주세요", 400)

    // 화면의 maxLength는 UX다. 신뢰 경계는 여기다 — 상한이 없으면 본문 한 건이
    // 목록 응답(글 20개) 전체를 무겁게 만든다
    if (title.length > TITLE_MAX) {
      return fail("TITLE_TOO_LONG", `제목은 ${TITLE_MAX}자까지 쓸 수 있어요`, 400)
    }
    if (body.length > BODY_MAX) {
      return fail("BODY_TOO_LONG", `본문은 ${BODY_MAX}자까지 쓸 수 있어요`, 400)
    }

    // 스키마의 GalleryType enum에 있는 값만 받는다(ALL 포함).
    const galleryType = (Object.values(GalleryType) as string[]).includes(requested)
      ? (requested as GalleryType)
      : null
    if (!galleryType) return fail("INVALID_BODY", "갤러리를 찾을 수 없어요", 400)

    // ALL은 누구나, 종족 갤러리는 본인 종족만 쓸 수 있다.
    if (!canAccessGallery(galleryType, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리에는 글을 쓸 수 없어요", 400)
    }

    // 검증을 통과한 요청만 센다. 빈 제목으로 다섯 번 막히면 정상 사용자가 10분 잠긴다
    recordAttempt(rateKey, POST_WINDOW_MS)

    const post = await prisma.post.create({
      data: { userId: user.id, galleryType, title, body },
      include: { user: { select: { nickname: true, typeCode: true } } },
    })

    const granted = await grantAffinity(user, POST_AFFINITY)

    // 미션 완료는 본 동작이 끝난 뒤에 별도 try/catch로 부른다.
    // 트랜잭션에 넣지 않는다 — 미션 실패가 글 작성을 롤백시키면 안 된다.
    // 중복 완료는 completeMission 내부에서 P2002를 잡아 newlyCompleted:false로 돌려준다.
    //
    // 주의: completeMission은 하루 상한을 넘겨받은 actor.affinityToday(메모리 값)로 계산하는데
    // 바로 위 grantAffinity는 DB만 갱신하고 user 객체는 그대로 둔다. 두 미션의 rewardAffinity가
    // 0이라(prisma/seed/missions.ts, 2026-08-20 결정) 지금은 무해하지만, 0보다 큰 값을 넣으면
    // 이 호출이 낡은 affinityToday를 보고 하루 상한 100을 넘길 수 있다.
    try {
      await completeMissionByCode({ actor: user, code: "DAILY_COMMUNITY_POST" })
    } catch (error) {
      console.error("[DAILY_COMMUNITY_POST] 미션 완료 처리 실패", error)
    }

    return ok({ post, granted })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
