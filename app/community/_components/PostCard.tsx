import { TRIBE, authorLabel } from "@/lib/types"
import type { GalleryPost } from "../_lib/gallery"
import { timeAgo } from "../_lib/format"

export function PostCard({ post, showTribeBadge }: { post: GalleryPost; showTribeBadge: boolean }) {
  const tribe = post.user.typeCode ? TRIBE[post.user.typeCode] : null

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm">
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
            {tribe.family}
          </span>
        )}
      </div>

      <div>
        <p className="mb-1 line-clamp-1 font-medium text-neutral-900">{post.title}</p>
        <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600">{post.body}</p>
      </div>

      <div className="flex gap-4 text-xs text-neutral-400">
        <span>좋아요 {post.likeCount}</span>
        <span>댓글 {post.commentCount}</span>
      </div>
    </div>
  )
}
