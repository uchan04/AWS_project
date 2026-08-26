import { GalleryType } from "@prisma/client"
import type { TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { cdnUrl } from "@/lib/assets"

/**
 * 갤러리 탭. 스키마의 `GalleryType`(TypeCode 3종 + ALL)과 값이 같아 그대로 쓴다.
 * 2026-08-20 이전에는 `Post.galleryType`이 `TypeCode`라 ALL이 DB에 없었고,
 * "ALL" | TypeCode 합성 타입으로 화면 전용 개념을 표현해야 했다.
 */
export type GalleryTab = GalleryType

const POST_LIST_LIMIT = 20

/**
 * tab 파라미터를 갤러리로 **해석만 한다.**
 *
 * `mine`이면 본인 종족, 종족 코드를 직접 준 경우 그 종족, 그 외에는 전체다.
 *
 * **여기서 권한을 보지 않는다.** 이 함수는 "무엇을 보려는가"를 읽을 뿐이고
 * "볼 수 있는가"는 `canViewGallery()`가 판정한다. 둘을 한 함수에 합치면 한쪽만
 * 고쳤을 때 조용히 열린다 — 그래서 비관리자가 `tab=HEALTH_EMOTION`을 직접 붙여도
 * 여기서는 그대로 통과하고 **접근 검사에서 막힌다.** 호출부는 반드시 둘을 함께 쓴다.
 */
export function resolveGallery(tabParam: string | undefined, myTypeCode: TypeCode | null): GalleryTab {
  if (tabParam === "mine" && myTypeCode) return myTypeCode
  if (tabParam && (Object.values(GalleryType) as string[]).includes(tabParam)) {
    return tabParam as GalleryTab
  }
  return "ALL"
}

/*
 * ── 읽기와 쓰기를 **다른 함수로** 가른다 (2026-08-26) ─────────────────────────
 *
 * 전에는 `canAccessGallery()` 하나를 읽기 3곳·쓰기 4곳이 함께 썼다. 관리자 우회를
 * 그 함수에 넣으면 **관리자가 남의 종족 갤러리에 글·댓글·좋아요를 남기게 된다.**
 * 그러면 "이 갤러리는 이 종족만"이라는 약속이 운영자 손으로 깨지고, 글의 종족
 * 표시(`galleryType`)와 작성자 종족이 어긋난다.
 *
 * 그래서 이름을 갈랐고, **`canAccessGallery`는 지웠다** — 남겨두면 새 라우트가
 * 애매한 쪽을 고를 수 있다. 지금은 고를 수 있는 것이 둘뿐이고 이름이 용도를 말한다.
 *
 * `canPostToGallery()`에는 **isAdmin 인자가 없다.** 플래그를 옵션으로 두면 읽기·쓰기
 * 구분이 호출부 인자 하나에 숨어서, 새 라우트가 무심코 true를 넘기기 쉽다.
 * 인자가 아예 없으면 그렇게 열 수가 없다.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** 읽기. 관리자는 모든 종족 갤러리를 본다. 전체 탭은 누구나. */
export function canViewGallery(gallery: GalleryTab, myTypeCode: TypeCode | null, isAdmin: boolean): boolean {
  return gallery === "ALL" || gallery === myTypeCode || isAdmin
}

/**
 * 쓰기(글·댓글·좋아요·주제 추천). **관리자도 자기 종족에만 쓴다.**
 * 우회 인자를 두지 않는다 — 위 블록 주석 참고.
 */
export function canPostToGallery(gallery: GalleryTab, myTypeCode: TypeCode | null): boolean {
  return gallery === "ALL" || gallery === myTypeCode
}

/**
 * 첨부 사진의 표시 URL. `lib/assets.ts`의 `cdnUrl()`이 프로젝트에서 CloudFront 주소를 만드는
 * 유일한 경로라 그대로 쓴다(규칙을 두 벌 두면 한쪽만 고쳐도 조용히 어긋난다는 그 파일 주석).
 *
 * **서버에서 붙여 내려보내는 이유**: `CLOUDFRONT_DOMAIN`에 `NEXT_PUBLIC_` 접두사가 없어
 * 브라우저 번들에서는 읽히지 않는다. 목록을 그리는 `PostCard`는 `PostList`("use client")
 * 아래라 클라이언트에서 도는데, 거기서 조립하려 들면 `undefined/…`가 된다.
 * `CLOUDFRONT_DOMAIN`이 비어 있으면 null이고, 호출부는 사진 영역 자체를 그리지 않는다.
 */
export function postImageUrl(imageKey: string | null): string | null {
  return imageKey ? cdnUrl(imageKey) : null
}

export async function listGalleryPosts(gallery: GalleryTab) {
  // "ALL"도 galleryType 조건에 넣는다. 전체 탭은 "모든 글"이 아니라 "전체 커뮤니티
  // 갤러리에 쓴 글"을 보여주는 곳이다. 조건을 빼면 종족 갤러리 글까지 전체 탭에 뜨는데,
  // 종족 갤러리는 "그 종족만 볼 수 있다"고 약속하고 받은 글이라 다른 종족에 노출되면 안 된다.
  const posts = await prisma.post.findMany({
    where: { deletedAt: null, galleryType: gallery },
    orderBy: { createdAt: "desc" },
    take: POST_LIST_LIMIT,
    // isAdmin은 작성자 표기용이다(_lib/author.ts). **필드를 더 늘리지 마라** —
    // 이 select 절이 subTypeCode 같은 값이 목록 응답에 새는 것을 막는 자리다.
    include: { user: { select: { nickname: true, typeCode: true, isAdmin: true } } },
  })

  // imageKey는 include가 스칼라를 다 주므로 이미 들어 있다. URL만 얹는다.
  return posts.map((post) => ({ ...post, imageUrl: postImageUrl(post.imageKey) }))
}

export type GalleryPost = Awaited<ReturnType<typeof listGalleryPosts>>[number]
