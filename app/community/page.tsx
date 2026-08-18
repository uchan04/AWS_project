import { getCurrentUser } from "@/lib/auth"
import { TRIBE } from "@/lib/types"
import { GalleryTabs } from "./_components/GalleryTabs"
import { PostList } from "./_components/PostList"
import { resolveGallery, listGalleryPosts } from "./_lib/gallery"

export default async function CommunityPage(props: PageProps<"/community">) {
  const searchParams = await props.searchParams
  const tab = typeof searchParams.tab === "string" ? searchParams.tab : undefined

  const user = await getCurrentUser()
  const gallery = resolveGallery(tab, user.typeCode)
  const posts = await listGalleryPosts(gallery)

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">커뮤니티</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {gallery === "ALL"
            ? "모든 종족이 함께하는 열린 공간이에요"
            : `${TRIBE[gallery].animal} 종족 전용 공간이에요 · 나만 볼 수 있어요`}
        </p>
      </div>

      <GalleryTabs active={gallery} myTypeCode={user.typeCode} />

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
