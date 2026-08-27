import { GalleryType } from "@prisma/client"
import type { Prisma, TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { cdnUrl } from "@/lib/assets"
import { POST_LIST_LIMIT } from "./queryLink"

/**
 * 갤러리 탭. 스키마의 `GalleryType`(TypeCode 3종 + ALL)과 값이 같아 그대로 쓴다.
 * 2026-08-20 이전에는 `Post.galleryType`이 `TypeCode`라 ALL이 DB에 없었고,
 * "ALL" | TypeCode 합성 타입으로 화면 전용 개념을 표현해야 했다.
 */
export type GalleryTab = GalleryType

/**
 * tab 파라미터를 갤러리로 **해석만 한다.**
 *
 * `mine`이면 본인 종족, 종족 코드를 직접 준 경우 그 종족, 그 외에는 전체다.
 *
 * **여기서 권한을 보지 않는다.** 이 함수는 "무엇을 보려는가"를 읽을 뿐이고
 * "볼 수 있는가"는 `canAccessGallery()`가 판정한다. 둘을 한 함수에 합치면 한쪽만
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
 * ── 읽기·쓰기를 나눴다가 **다시 합쳤다** (2026-08-26) ─────────────────────────
 *
 * 하루 사이에 두 번 바뀐 자리라 경위를 남긴다. 근거 없이 합쳐진 것처럼 보이면 다음
 * 사람이 또 나눈다.
 *
 * **나눴던 이유**: 관리자에게 읽기만 열기로 했을 때, 우회를 `canAccessGallery()`
 * 한 곳에 넣으면 읽기 3곳·쓰기 4곳이 같은 함수를 쓰고 있어서 **쓰기까지 함께 열렸다.**
 * 관리자가 남의 종족 갤러리에 글·댓글·좋아요를 남기면 "이 갤러리는 이 종족만"이라는
 * 약속이 운영자 손으로 깨진다. 그래서 `canViewGallery`/`canPostToGallery`로 갈랐고,
 * 쓰기 쪽에는 우회할 인자조차 두지 않았다.
 *
 * **다시 합친 이유**: 쓰기도 열기로 결정하면서 두 함수가 **모든 입력에서 같은 값**을
 * 돌려주게 됐다 — 비관리자는 둘 다 "ALL + 본인 종족", 관리자는 둘 다 전부다.
 * 항상 같은 값을 주는 함수를 둘로 두면 나중에 한쪽만 고쳐져 조용히 갈라진다.
 * 실제로 그렇게 갈라지면 "관리자가 글은 쓰는데 자기 공지에 답글은 못 다는" 형태의
 * 고장이 된다.
 *
 * **다시 나눠야 하는 조건은 하나다** — 관리자의 읽기 권한과 쓰기 권한이 달라지는 날.
 * 그날이 오면 위 "나눴던 이유"를 그대로 따르면 된다. 그전에는 나누지 마라.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * 이 갤러리를 읽고 쓸 수 있는가. 전체 탭은 누구나, 종족 갤러리는 본인 종족만,
 * **관리자는 전부**.
 *
 * 읽기(목록·상세·서버 렌더)와 쓰기(글·댓글·좋아요·주제 추천) **7곳이 모두 이 함수를 쓴다.**
 * 한 곳이라도 다른 판정을 쓰면 위 주석의 "조용히 갈라진다"가 그대로 일어난다.
 */
export function canAccessGallery(gallery: GalleryTab, myTypeCode: TypeCode | null, isAdmin: boolean): boolean {
  return gallery === "ALL" || gallery === myTypeCode || isAdmin
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

/**
 * 갤러리 목록 조회. **목록을 읽는 유일한 진입점이다** — 서버 컴포넌트(`page.tsx`)와
 * 라우트(`GET /api/community/posts`)가 이 함수 하나를 공유한다.
 *
 * **두 번째 조회 함수를 만들지 마라.** where 절이 두 곳에 생기면 한쪽만 고쳐졌을 때
 * 전체 탭에 다른 종족 글이 새는 사고(8/22)가 그대로 재현된다. 검색·페이지도 그래서
 * 새 함수가 아니라 이 함수의 옵션으로 들어와 있다.
 */
export async function listGalleryPosts(gallery: GalleryTab, opts?: { q?: string; page?: number }) {
  const q = opts?.q ?? ""
  const requestedPage = Math.max(1, opts?.page ?? 1)

  /*
   * where는 **지역 상수 하나**다. findMany와 count가 같은 객체를 봐야 목록과 총 개수가
   * 어긋나지 않는다 — 따로 적으면 한쪽에만 조건이 붙어 "12개씩 3페이지인데 3페이지가 비는"
   * 형태로 조용히 깨진다.
   *
   * "ALL"도 galleryType 조건에 넣는다. 전체 탭은 "모든 글"이 아니라 "전체 커뮤니티
   * 갤러리에 쓴 글"을 보여주는 곳이다. 조건을 빼면 종족 갤러리 글까지 전체 탭에 뜨는데,
   * 종족 갤러리는 "그 종족만 볼 수 있다"고 약속하고 받은 글이라 다른 종족에 노출되면 안 된다.
   *
   * **OR를 최상위로 올려 deletedAt·galleryType을 대체하지 마라. deletedAt을 OR 안에
   * 넣지도 마라.** 형제 조건은 AND로 묶이므로 지금 형태는 "안 지워졌고 + 이 갤러리이고 +
   * (제목이든 본문이든 검색어를 포함)"이다. OR가 위로 올라가면 조건이 통째로 대체돼
   * 삭제된 글과 남의 종족 글이 검색 결과로 샌다 — 위 8/22 사고와 같은 모양이다.
   * q는 **기존 조건 위에 얹히기만 한다.**
   */
  const where: Prisma.PostWhereInput = {
    deletedAt: null,
    galleryType: gallery,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  // orderBy·include·take는 페이지가 바뀌어도 같아야 해서 한 곳에 둔다. skip만 다르다.
  function fetchPage(page: number) {
    return prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * POST_LIST_LIMIT,
      take: POST_LIST_LIMIT,
      // isAdmin은 작성자 표기용이다(_lib/author.ts). **필드를 더 늘리지 마라** —
      // 이 select 절이 subTypeCode 같은 값이 목록 응답에 새는 것을 막는 자리다.
      include: { user: { select: { nickname: true, typeCode: true, isAdmin: true } } },
    })
  }

  // 목록과 총 개수는 서로의 결과를 쓰지 않는다. 순차로 두면 왕복이 두 배다(RDS가 us-east-1).
  const [firstPage, total] = await Promise.all([fetchPage(requestedPage), prisma.post.count({ where })])

  const totalPages = Math.max(1, Math.ceil(total / POST_LIST_LIMIT))
  const page = Math.min(requestedPage, totalPages)

  /*
   * 범위를 넘은 페이지를 clamp해 한 번 더 읽는다. **주소를 손으로 고친 경우에만** 걸리는
   * 드문 경로다(화면의 링크는 totalPages를 넘지 않는다).
   *
   * total이 0이면 다시 읽지 않는다 — 빈 갤러리·검색 결과 없음은 어느 페이지를 물어도
   * 빈 배열이라 왕복이 헛돈다.
   */
  const posts = total > 0 && page !== requestedPage ? await fetchPage(page) : firstPage

  // imageKey는 include가 스칼라를 다 주므로 이미 들어 있다. URL만 얹는다.
  return {
    posts: posts.map((post) => ({ ...post, imageUrl: postImageUrl(post.imageKey) })),
    total,
    page,
    totalPages,
  }
}

export type GalleryPost = Awaited<ReturnType<typeof listGalleryPosts>>["posts"][number]
