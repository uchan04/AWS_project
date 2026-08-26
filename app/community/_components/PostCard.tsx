import { TRIBE, authorLabel } from "@/lib/types"
import type { GalleryPost } from "../_lib/gallery"
import { timeAgo } from "../_lib/format"

export function PostCard({
  post,
  showTribeBadge,
  onClick,
}: {
  post: GalleryPost
  showTribeBadge: boolean
  onClick: () => void
}) {
  const tribe = post.user.typeCode ? TRIBE[post.user.typeCode] : null

  return (
    <button
      type="button"
      onClick={onClick}
      // 카드가 여러 개 나열되므로 scale은 쓰지 않는다(격자가 흔들린다). 그림자 한 단계 + 2px 부양만.
      className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 text-left transition duration-150 hover:border-neutral-300 hover:shadow-md focus-visible:border-neutral-300 focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {post.user.typeCode ? authorLabel(post.user.nickname, post.user.typeCode) : post.user.nickname}
          </p>
          <p className="text-xs text-neutral-400">{timeAgo(post.createdAt)}</p>
        </div>

        {showTribeBadge && tribe && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: `${tribe.colorHex}22`, color: tribe.colorHex }}
          >
            {tribe.animal}
          </span>
        )}
      </div>

      <div>
        <p className="mb-1 line-clamp-1 font-medium text-neutral-900">{post.title}</p>
        <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600">{post.body}</p>
      </div>

      {/* 썸네일. 사진 비율이 제각각이라 16:9로 잘라 고정한다 — 원본 비율로 두면 세로로 긴 사진
          하나가 격자 한 칸을 몇 배로 늘려 옆 카드와 높이가 어긋난다. 원본 비율은 상세에서 본다.
          next/image를 쓰지 않는 이유는 미션 화면과 같다 — 설정에 없는 hostname이면 렌더 중에 throw한다. */}
      {post.imageUrl && (
        <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex gap-4 text-xs text-neutral-400">
        <span>좋아요 {post.likeCount}</span>
        <span>댓글 {post.commentCount}</span>
      </div>
    </button>
  )
}
