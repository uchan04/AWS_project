import type { GalleryType, TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * 갤러리 탭. 스키마의 `GalleryType`(TypeCode 3종 + ALL)과 값이 같아 그대로 쓴다.
 * 2026-08-20 이전에는 `Post.galleryType`이 `TypeCode`라 ALL이 DB에 없었고,
 * "ALL" | TypeCode 합성 타입으로 화면 전용 개념을 표현해야 했다.
 */
export type GalleryTab = GalleryType

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

/**
 * 모든 갤러리에 글을 쓸 수 있다.
 * 2026-08-20 해소: `Post.galleryType`이 `GalleryType` enum이 되면서 ALL도 저장할 수 있게 됐다
 * (마이그레이션 `20260820130000_post_gallery_type_all`, E). 그전에는 전체 탭 글쓰기를 막았다.
 * 종족 갤러리의 소속 검사는 이 함수가 아니라 canAccessGallery()가 한다.
 */
export function canWriteToGallery(): boolean {
  return true
}

export function listGalleryPosts(gallery: GalleryTab) {
  // "ALL"도 galleryType 조건에 넣는다. 전체 탭은 "모든 글"이 아니라 "전체 커뮤니티
  // 갤러리에 쓴 글"을 보여주는 곳이다. 조건을 빼면 종족 갤러리 글까지 전체 탭에 뜨는데,
  // 종족 갤러리는 "그 종족만 볼 수 있다"고 약속하고 받은 글이라 다른 종족에 노출되면 안 된다.
  return prisma.post.findMany({
    where: { deletedAt: null, galleryType: gallery },
    orderBy: { createdAt: "desc" },
    take: POST_LIST_LIMIT,
    include: { user: { select: { nickname: true, typeCode: true } } },
  })
}

export type GalleryPost = Awaited<ReturnType<typeof listGalleryPosts>>[number]
