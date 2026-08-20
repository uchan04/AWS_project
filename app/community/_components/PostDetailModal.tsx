"use client"

import { useEffect, useState } from "react"
import type { TypeCode } from "@prisma/client"
import { authorLabel } from "@/lib/types"
import { timeAgo } from "../_lib/format"

type DetailUser = { nickname: string; typeCode: TypeCode | null }

type DetailComment = {
  id: string
  body: string
  createdAt: string
  user: DetailUser
  isOwn: boolean
}

type DetailPost = {
  id: string
  title: string
  body: string
  createdAt: string
  likeCount: number
  commentCount: number
  likedByMe: boolean
  isOwn: boolean
  user: DetailUser
}

function authorText(user: DetailUser): string {
  return user.typeCode ? authorLabel(user.nickname, user.typeCode) : user.nickname
}

export function PostDetailModal({
  postId,
  onClose,
  onDeleted,
}: {
  postId: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [post, setPost] = useState<DetailPost | null>(null)
  const [comments, setComments] = useState<DetailComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [likePending, setLikePending] = useState(false)
  const [commentBody, setCommentBody] = useState("")
  const [commentPending, setCommentPending] = useState(false)
  const [affinityNotice, setAffinityNotice] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  // 어느 댓글이 처리 중인지 구분한다. 단일 boolean이면 삭제 중에 모든 댓글 버튼이 같이 비활성화된다.
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)

    fetch(`/api/community/posts/${postId}`)
      .then((res) => res.json())
      .then((json) => {
        if (ignore) return
        if (json.error) {
          setError(json.error.message)
          return
        }
        setPost(json.data.post)
        setComments(json.data.comments)
      })
      .catch(() => {
        if (!ignore) setError("게시글을 불러오지 못했어요")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [postId])

  async function handleLike() {
    if (!post || likePending) return
    setLikePending(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, { method: "POST" })
      const json = await res.json()
      if (json.error) return
      setPost((prev) => (prev ? { ...prev, likedByMe: json.data.liked, likeCount: json.data.likeCount } : prev))
    } finally {
      setLikePending(false)
    }
  }

  async function handleDelete() {
    if (!post || deletePending) return
    setDeletePending(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
        return
      }
      onDeleted()
    } finally {
      setDeletePending(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (deletingCommentId) return
    setDeletingCommentId(commentId)
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments/${commentId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
        return
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setPost((prev) => (prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev))
    } finally {
      setDeletingCommentId(null)
    }
  }

  async function handleComment() {
    const trimmed = commentBody.trim()
    if (!trimmed || commentPending) return
    setCommentPending(true)
    setAffinityNotice(null)
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
        return
      }
      setComments((prev) => [...prev, json.data.comment])
      setCommentBody("")
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev))
      setAffinityNotice(json.data.granted > 0 ? `친밀도 +${json.data.granted}` : "오늘 친밀도를 이미 다 받았어요")
    } finally {
      setCommentPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-500">불러오는 중...</div>
        ) : error || !post ? (
          <div className="flex flex-col gap-4 p-10 text-center text-sm text-neutral-500">
            <p>{error ?? "게시글을 찾을 수 없어요"}</p>
            <button
              type="button"
              onClick={onClose}
              className="mx-auto rounded-lg border border-neutral-300 px-4 py-2 text-sm"
            >
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-neutral-200 px-7 py-5">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{authorText(post.user)}</p>
                <p className="text-xs text-neutral-400">{timeAgo(new Date(post.createdAt))}</p>
              </div>
              <div className="flex items-center gap-2">
                {post.isOwn && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deletePending}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-60"
                  >
                    삭제
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-6">
              <h2 className="mb-2 text-lg font-bold text-neutral-900">{post.title}</h2>
              <p className="mb-6 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">{post.body}</p>

              <button
                type="button"
                onClick={handleLike}
                disabled={likePending}
                className={
                  "mb-7 rounded-full border px-5 py-2 text-sm font-semibold transition disabled:opacity-60 " +
                  (post.likedByMe
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50")
                }
              >
                좋아요 {post.likeCount}
              </button>

              <div className="border-t border-neutral-200 pt-5">
                <p className="mb-4 text-xs text-neutral-500">댓글 {post.commentCount}개</p>
                <div className="flex flex-col gap-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-neutral-50 p-4">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">{authorText(comment.user)}</span>
                        <span className="text-xs text-neutral-400">{timeAgo(new Date(comment.createdAt))}</span>
                        {comment.isOwn && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={deletingCommentId === comment.id}
                            className="ml-auto rounded-lg border border-neutral-300 px-2 py-1 text-[11px] text-neutral-500 hover:bg-white disabled:opacity-60"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-neutral-700">{comment.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-200 px-7 py-4">
              {affinityNotice && <p className="text-xs text-neutral-400">{affinityNotice}</p>}
              <div className="flex gap-2">
                <input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  placeholder="따뜻한 댓글을 남겨봐요"
                  className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-neutral-500"
                />
                <button
                  type="button"
                  onClick={handleComment}
                  disabled={commentPending || !commentBody.trim()}
                  className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  전송
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
