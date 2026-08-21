"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PostCard } from "./PostCard"
import { PostDetailModal } from "./PostDetailModal"
import type { GalleryPost } from "../_lib/gallery"

/**
 * page.tsx는 서버 컴포넌트라 useState를 못 쓴다. selectedPostId 상태를 들고 있으려면
 * 클라이언트 경계가 하나 필요해서 이 파일로 분리했다. 지시된 "만들 파일" 목록엔 없지만
 * "목록 페이지에서 useState로 selectedPostId를 들고" 요구를 만족하려면 구조상 불가피하다.
 */
export function PostList({ posts, showTribeBadge }: { posts: GalleryPost[]; showTribeBadge: boolean }) {
  const router = useRouter()
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)

  function handleDeleted() {
    setSelectedPostId(null)
    router.refresh()
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            showTribeBadge={showTribeBadge}
            onClick={() => setSelectedPostId(post.id)}
          />
        ))}
      </div>

      {selectedPostId && (
        <PostDetailModal
          key={selectedPostId}
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  )
}
