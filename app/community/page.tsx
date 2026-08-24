import type { TypeCode } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth"
import { TRIBE } from "@/lib/types"
import { GalleryTabs } from "./_components/GalleryTabs"
import { HopeBanner } from "./_components/HopeBanner"
import { PostList } from "./_components/PostList"
import { WriteModal } from "./_components/WriteModal"
import { resolveGallery, listGalleryPosts, type GalleryTab, type GalleryPost } from "./_lib/gallery"
import { MeetupNotice } from "./meetups/_components/MeetupNotice"
import { pendingMeetupNotices, type MeetupNoticeItem } from "./meetups/_lib/notice"

// 유저별 데이터를 읽으므로 정적 프리렌더 대상이 아니다. 이걸 빼면 빌드 시점에
// 아래 catch의 안내 화면이 정적으로 굳어 로그인한 뒤에도 그대로 나온다(pet/page.tsx와 같은 이유).
export const dynamic = "force-dynamic"

export default async function CommunityPage(props: PageProps<"/community">) {
  const searchParams = await props.searchParams
  const tab = typeof searchParams.tab === "string" ? searchParams.tab : undefined

  let myTypeCode: TypeCode | null
  let gallery: GalleryTab
  let posts: GalleryPost[]
  let notices: MeetupNoticeItem[]

  // 인증이나 DB가 실패해도 화면을 죽이지 않고 안내를 띄운다(C의 pet/page.tsx와 같은 패턴).
  try {
    const user = await getCurrentUser()
    myTypeCode = user.typeCode
    gallery = resolveGallery(tab, user.typeCode)
    posts = await listGalleryPosts(gallery)
    // 모임 화면에 들르지 않아도 무산 사실은 알아야 한다. 커뮤니티 첫 화면에도 같은 배너를 띄운다.
    notices = await pendingMeetupNotices(user.id)
  } catch (error) {
    console.error("[/community]", error)
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <h1 className="text-xl font-bold text-neutral-900">커뮤니티</h1>
        <div className="rounded-2xl bg-white p-8 text-center">
          <p className="text-sm text-neutral-700">로그인이 필요해요</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            진단을 아직 안 했다면 진단을 먼저 완료해 주세요.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <MeetupNotice notices={notices} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">커뮤니티</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {gallery === "ALL"
              ? "모든 종족이 함께하는 열린 공간이에요"
              : `${TRIBE[gallery].animal} 종족 전용 공간이에요 · 나만 볼 수 있어요`}
          </p>
        </div>
        <WriteModal gallery={gallery} />
      </div>

      <GalleryTabs active={gallery} myTypeCode={myTypeCode} />

      <HopeBanner gallery={gallery} />

      {posts.length === 0 ? (
        <p className="py-24 text-center text-sm leading-relaxed text-neutral-500">
          아직 글이 없어요.
          <br />
          첫 번째 이야기를 들려주세요.
        </p>
      ) : (
        <PostList posts={posts} showTribeBadge={gallery === "ALL"} />
      )}
    </main>
  )
}
