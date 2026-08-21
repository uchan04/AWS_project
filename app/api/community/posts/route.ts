import type { NextRequest } from "next/server"
import { getCurrentUser, getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { GalleryType } from "@prisma/client"
import { resolveGallery, canAccessGallery, listGalleryPosts } from "@/app/community/_lib/gallery"
import { grantAffinity, POST_AFFINITY } from "@/app/community/_lib/affinity"
import { completeMissionByCode } from "@/lib/missions/completion"

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

    const payload = await request.json().catch(() => null)
    const title = typeof payload?.title === "string" ? payload.title.trim() : ""
    const body = typeof payload?.body === "string" ? payload.body.trim() : ""
    const requested = typeof payload?.galleryType === "string" ? payload.galleryType : GalleryType.ALL

    if (!title || !body) return fail("INVALID_BODY", "제목과 본문을 입력해주세요", 400)

    // 스키마의 GalleryType enum에 있는 값만 받는다(ALL 포함).
    const galleryType = (Object.values(GalleryType) as string[]).includes(requested)
      ? (requested as GalleryType)
      : null
    if (!galleryType) return fail("INVALID_BODY", "갤러리를 찾을 수 없어요", 400)

    // ALL은 누구나, 종족 갤러리는 본인 종족만 쓸 수 있다.
    if (!canAccessGallery(galleryType, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리에는 글을 쓸 수 없어요", 400)
    }

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
