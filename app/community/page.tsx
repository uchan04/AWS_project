import { redirect } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { TRIBE } from "@/lib/types"
import { GalleryTabs } from "./_components/GalleryTabs"
import { HopeBanner } from "./_components/HopeBanner"
import { PostList } from "./_components/PostList"
import { WriteModal } from "./_components/WriteModal"
import { RulesModal } from "./_components/RulesModal"
import { resolveGallery, canAccessGallery, listGalleryPosts, type GalleryTab, type GalleryPost } from "./_lib/gallery"
import { MeetupNotice } from "./meetups/_components/MeetupNotice"
import { pendingMeetupNotices, type MeetupNoticeItem } from "./meetups/_lib/notice"

// 유저별 데이터를 읽으므로 정적 프리렌더 대상이 아니다. 이걸 빼면 빌드 시점에
// 아래 catch의 안내 화면이 정적으로 굳어 로그인한 뒤에도 그대로 나온다(pet/page.tsx와 같은 이유).
export const dynamic = "force-dynamic"

export default async function CommunityPage(props: PageProps<"/community">) {
  const searchParams = await props.searchParams
  const tab = typeof searchParams.tab === "string" ? searchParams.tab : undefined

  let myTypeCode: TypeCode | null
  let isAdmin: boolean
  let gallery: GalleryTab
  let posts: GalleryPost[]
  let notices: MeetupNoticeItem[]

  // 인증이나 DB가 실패해도 화면을 죽이지 않고 안내를 띄운다(C의 pet/page.tsx와 같은 패턴).
  try {
    const user = await getCurrentUser()
    myTypeCode = user.typeCode
    isAdmin = user.isAdmin
    // resolveGallery()는 해석만 한다. **볼 수 있는지는 여기서 판정한다** —
    // 비관리자가 tab=<다른 종족>을 직접 붙이면 이 검사에서 전체 탭으로 떨어진다.
    // 라우트(GET /api/community/posts)도 같은 쌍을 쓴다.
    const requested = resolveGallery(tab, user.typeCode)
    gallery = canAccessGallery(requested, user.typeCode, user.isAdmin) ? requested : "ALL"
    posts = await listGalleryPosts(gallery)
    // 모임 화면에 들르지 않아도 무산 사실은 알아야 한다. 커뮤니티 첫 화면에도 같은 배너를 띄운다.
    notices = await pendingMeetupNotices(user.id)
  } catch (error) {
    // 미인증이면 로그인으로 보낸다. 여기 남는 카드는 DB 장애용이다 —
    // 장애에 "로그인이 필요해요"를 띄우면 이미 로그인한 사람이 로그아웃하고
    // 다시 로그인하는 헛수고를 한다(/pet과 같은 이유).
    if (error instanceof UnauthorizedError) redirect("/login?next=%2Fcommunity")
    console.error("[/community]", error)
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <h1 className="text-xl font-bold text-ink">커뮤니티</h1>
        <div className="rounded-card bg-card p-8 text-center">
          <p className="text-sm text-ink-2">글을 불러오지 못했어요</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">잠시 후 다시 들어와 주세요.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <MeetupNotice notices={notices} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">커뮤니티</h1>
          <p className="mt-1 text-sm text-muted">
            {/* "나만 볼 수 있어요"는 관리자에게 사실이 아니다 — 관리자는 모든 종족을 본다.
                관리자는 읽기·쓰기가 모두 열려 갤러리마다 할 수 있는 일이 다르지 않으므로
                한 갈래로 둔다. 신분은 탭 줄이 한 번만 알린다(GalleryTabs) */}
            {gallery === "ALL"
              ? "모든 종족이 함께하는 열린 공간이에요"
              : isAdmin
                ? `${TRIBE[gallery].animal} 종족 갤러리예요`
                : `${TRIBE[gallery].animal} 종족 전용 공간이에요 · 나만 볼 수 있어요`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RulesModal />
          <WriteModal gallery={gallery} myTypeCode={myTypeCode} />
        </div>
      </div>

      <GalleryTabs active={gallery} myTypeCode={myTypeCode} isAdmin={isAdmin} />

      {/* 희망 문구 배너(SPEC 9절). 탭 아래에 둔다 — 배너 문구가 지금 고른 탭에 따라
          갈리므로("고양잇과족에게:"), 원인인 탭이 결과인 배너보다 위에 있어야 읽힌다.
          위에 두면 아래 탭을 눌러 위가 바뀌는 순서가 된다 */}
      <HopeBanner gallery={gallery} />

      {posts.length === 0 ? (
        <p className="py-24 text-center text-sm leading-relaxed text-muted">
          아직 글이 없어요.
          <br />
          첫 번째 이야기를 들려주세요.
        </p>
      ) : (
        <PostList posts={posts} showTribeBadge={gallery === "ALL"} isAdmin={isAdmin} />
      )}
    </main>
  )
}
