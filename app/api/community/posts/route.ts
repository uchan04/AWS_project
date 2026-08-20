import type { NextRequest } from "next/server"
import { getCurrentUser, getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { GalleryType } from "@prisma/client"
import { resolveGallery, canAccessGallery, listGalleryPosts } from "@/app/community/_lib/gallery"
import { grantAffinity, POST_AFFINITY } from "@/app/community/_lib/affinity"

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

    // TODO: 미션 완료 연결 — B의 completeMission 대기
    // 확정 대기: import 경로 / 반환값(void 또는 {completed,rewardSeeds,rewardAffinity}) / 중복 시 completed:false
    // 트랜잭션에 넣지 말 것. 미션 실패가 글 작성을 롤백시키면 안 된다.
    // try {
    //   await completeMission(user.id, "DAILY_COMMUNITY_POST")
    // } catch (e) {
    //   console.error("미션 완료 처리 실패", e)
    // }

    const granted = await grantAffinity(user, POST_AFFINITY)

    return ok({ post, granted })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
