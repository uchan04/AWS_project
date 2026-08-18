import type { NextRequest } from "next/server"
import { getCurrentUser, getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import {
  resolveGallery,
  canAccessGallery,
  canWriteToGallery,
  listGalleryPosts,
  type GalleryTab,
} from "@/app/community/_lib/gallery"
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
    const galleryType = (typeof payload?.galleryType === "string" ? payload.galleryType : "ALL") as GalleryTab

    if (!title || !body) return fail("INVALID_BODY", "제목과 본문을 입력해주세요", 400)

    if (!canAccessGallery(galleryType, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리에는 글을 쓸 수 없어요", 400)
    }
    if (!canWriteToGallery(galleryType)) {
      return fail("FORBIDDEN", "전체 커뮤니티 글쓰기는 아직 지원하지 않아요", 400)
    }

    const post = await prisma.post.create({
      data: { userId: user.id, galleryType, title, body },
      include: { user: { select: { nickname: true, typeCode: true } } },
    })

    // TODO: DAILY_COMMUNITY_POST 완료 처리 — 담당 B와 협의 중

    const granted = await grantAffinity(user, POST_AFFINITY)

    return ok({ post, granted })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
