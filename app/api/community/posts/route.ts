import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { resolveGallery, canAccessGallery, listGalleryPosts } from "@/app/community/_lib/gallery"

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
