import type { TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * "전체" 탭은 스키마에 없는 가상 갤러리다. Post.galleryType은 TypeCode 3종뿐이고
 * ALL은 DB 값이 아니라 "갤러리 필터 없음"을 뜻하는 화면 전용 개념이다.
 * 스키마에 실제 공용 게시판 개념이 생기면 이 파일의 galleryTypeFilter()만 고치면 된다.
 */
export type GalleryTab = "ALL" | TypeCode

const POST_LIST_LIMIT = 20

/** tab=mine이고 진단을 마친 유저면 본인 종족, 그 외에는 전체. */
export function resolveGallery(tabParam: string | undefined, myTypeCode: TypeCode | null): GalleryTab {
  if (tabParam === "mine" && myTypeCode) return myTypeCode
  return "ALL"
}

/** 종족 갤러리는 본인 종족만 접근할 수 있다. 전체 탭은 누구나 접근 가능. */
export function canAccessGallery(gallery: GalleryTab, myTypeCode: TypeCode | null): boolean {
  return gallery === "ALL" || gallery === myTypeCode
}

function galleryTypeFilter(gallery: GalleryTab) {
  return gallery === "ALL" ? {} : { galleryType: gallery }
}

export function listGalleryPosts(gallery: GalleryTab) {
  return prisma.post.findMany({
    where: { deletedAt: null, ...galleryTypeFilter(gallery) },
    orderBy: { createdAt: "desc" },
    take: POST_LIST_LIMIT,
    include: { user: { select: { nickname: true, typeCode: true } } },
  })
}

export type GalleryPost = Awaited<ReturnType<typeof listGalleryPosts>>[number]
