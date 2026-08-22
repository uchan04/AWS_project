"use client"

import { useEffect, useState } from "react"
import type { TypeCode } from "@prisma/client"
import { authorLabel } from "@/lib/types"
import { useModalA11y } from "@/app/components/useModalA11y"
import { timeAgo } from "../_lib/format"
import { COMMENT_MAX, remaining } from "../_lib/limits"

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
  // Escape로 닫기 · 초점 가두기 · 닫을 때 열었던 글 카드로 초점 되돌리기
  // (app/components/useModalA11y.ts). PostList가 key={selectedPostId}로 그리므로
  // 이 컴포넌트는 열릴 때만 마운트된다 — open 인자는 필요 없다
  const boxRef = useModalA11y(onClose)
  const [post, setPost] = useState<DetailPost | null>(null)
  const [comments, setComments] = useState<DetailComment[]>([])
  const [loading, setLoading] = useState(true)
  // error는 최초 GET 실패 전용(모달 전체를 에러 화면으로 바꾼다).
  // 좋아요·댓글·삭제 등 액션 실패는 actionError로 분리해 하단에 인라인으로만 띄운다.
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [likePending, setLikePending] = useState(false)
  const [commentBody, setCommentBody] = useState("")
  const [commentPending, setCommentPending] = useState(false)
  const [affinityNotice, setAffinityNotice] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  // 어느 댓글이 처리 중인지 구분한다. 단일 boolean이면 삭제 중에 모든 댓글 버튼이 같이 비활성화된다.
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  // 마운트 시 한 번만 로드한다. loading=true / error=null은 useState 초기값이 이미 그 상태라
  // 이펙트 본문에서 다시 세팅하지 않는다(react-hooks/set-state-in-effect).
  // PostList가 key={selectedPostId}로 렌더하므로 다른 글을 열면 컴포넌트가 새로 마운트된다.
  useEffect(() => {
    let ignore = false

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
    setActionError(null)
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, { method: "POST" })
      const json = await res.json()
      if (json.error) {
        setActionError(json.error.message)
        return
      }
      setPost((prev) => (prev ? { ...prev, likedByMe: json.data.liked, likeCount: json.data.likeCount } : prev))
    } finally {
      setLikePending(false)
    }
  }

  async function handleDelete() {
    if (!post || deletePending) return
    setDeletePending(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/community/posts/${postId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.error) {
        setActionError(json.error.message)
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
    setActionError(null)
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments/${commentId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.error) {
        setActionError(json.error.message)
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
    setActionError(null)
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      const json = await res.json()
      if (json.error) {
        setActionError(json.error.message)
        return
      }
      setComments((prev) => [...prev, json.data.comment])
      setCommentBody("")
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev))
      setAffinityNotice(json.data.granted > 0 ? `친밀도 +${json.data.granted}` : "오늘 친밀도를 이미 다 받았어요")
      window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } finally {
      setCommentPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={post ? post.title : "게시글"}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-500" role="status" aria-live="polite">
            불러오는 중...
          </div>
        ) : error || !post ? (
          <div className="flex flex-col gap-4 p-10 text-center text-sm text-neutral-500">
            <p role="alert">{error ?? "게시글을 찾을 수 없어요"}</p>
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
                  aria-label="게시글 창 닫기"
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
              {/* 좋아요·댓글 결과는 화면 아래 작은 글씨로만 뜬다.
                  live region이 없으면 눌러도 아무 일도 안 일어난 것처럼 읽힌다 */}
              {actionError && (
                <p role="alert" className="text-xs text-red-500">
                  {actionError}
                </p>
              )}
              {affinityNotice && (
                <p role="status" aria-live="polite" className="text-xs text-neutral-400">
                  {affinityNotice}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  placeholder="따뜻한 댓글을 남겨봐요"
                  // placeholder는 접근 가능한 이름이 아니다 — 입력하면 사라진다
                  aria-label="댓글"
                  // maxLength는 UX다. 실제 거절은 서버가 한다
                  maxLength={COMMENT_MAX}
                  className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-500"
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
              {/* 한 줄 입력이라 늘 띄우면 시끄럽다. 50자 남았을 때만 */}
              {remaining(commentBody, COMMENT_MAX) <= 50 && (
                <p className="mt-1 text-right text-xs text-amber-600" aria-live="polite">
                  {commentBody.length} / {COMMENT_MAX}자
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
