"use client"

import { useEffect, useRef, useState } from "react"
import type { TypeCode } from "@prisma/client"
import { authorLabel } from "@/lib/types"
import { useModalA11y } from "@/app/components/useModalA11y"
import { CrisisNotice } from "@/app/components/CrisisNotice"
import { timeAgo } from "../_lib/format"
import { COMMENT_MAX, remaining } from "../_lib/limits"

/*
 * 인라인 확인용 상수. MeetupCard의 같은 값을 그대로 옮겨 적었다 — 그쪽은 모듈 지역 상수라
 * export되지 않고, 꺼내려면 MeetupCard를 고쳐야 한다. WriteModal이 NEUTRAL_COLOR를 자기
 * 파일에 둔 것과 같은 판단이다(공유 파일을 브랜치에서 건드리는 비용이 더 크다).
 *
 * **window.confirm을 쓰지 않는다.** MeetupCard가 무산 확인에서 같은 결론을 내렸다 —
 * 높이·투명도를 함께 전환하려고 항상 렌더해 두고 max-h로 접는다. 접혀 있는 동안에는
 * 버튼을 disabled로 둬서 탭 이동에도 잡히지 않는다.
 */
const EXPAND_BASE = "overflow-hidden motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
const EXPAND_CLOSED = "max-h-0 opacity-0"
const EXPAND_PANEL = "flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3"

const BUTTON_BASE =
  "inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-40"
const QUIET_BUTTON = BUTTON_BASE + " border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"

/**
 * 남의 것을 지우는 버튼. 테두리와 글자만 빨강이고 **채움 배경은 쓰지 않는다** —
 * 무산의 빨강 채움은 확인 뒤 2단계 확정 버튼 자리라 급이 다르다. 여기는 1단계 진입이다.
 */
const ADMIN_DELETE_POST =
  "rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
const ADMIN_DELETE_COMMENT =
  "ml-auto rounded-lg border border-red-300 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-60"

/** 댓글 확인 대기가 저절로 풀리는 시간. 대기 중인 것을 잊고 다시 누르는 사고를 막는다. */
const COMMENT_CONFIRM_MS = 3000

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
  // 첨부 사진. 없으면 둘 다 null이고, CLOUDFRONT_DOMAIN이 비어 있으면 key만 있고 url이 null이다.
  imageKey: string | null
  imageUrl: string | null
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
  isAdmin,
}: {
  postId: string
  onClose: () => void
  onDeleted: () => void
  // 관리자면 남의 글·댓글에도 삭제 버튼을 띄운다. isOwn은 "본인 여부" 그대로 두고
  // 여기서 or로 더한다 — 서버가 내려주는 isOwn의 뜻을 바꾸지 않는다.
  isAdmin: boolean
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
  // 내 댓글에 위기 신호가 있을 때 나에게만 뜨는 안내. 댓글은 막지 않는다(lib/safety.ts)
  const [crisisNotice, setCrisisNotice] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  // 어느 댓글이 처리 중인지 구분한다. 단일 boolean이면 삭제 중에 모든 댓글 버튼이 같이 비활성화된다.
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  // 남의 글을 지울 때만 뜨는 확인 펼침. 본인 글은 지금처럼 바로 지운다.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // 남의 댓글은 라벨 전환으로 확인받는다. **한 번에 하나만** — 다른 댓글을 누르면 이전 것이 풀린다.
  const [confirmingCommentId, setConfirmingCommentId] = useState<string | null>(null)
  const confirmTimerRef = useRef<number | null>(null)

  function clearConfirmTimer() {
    if (confirmTimerRef.current !== null) {
      window.clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
  }

  function armCommentConfirm(commentId: string) {
    clearConfirmTimer()
    setConfirmingCommentId(commentId)
    confirmTimerRef.current = window.setTimeout(() => {
      setConfirmingCommentId(null)
      confirmTimerRef.current = null
    }, COMMENT_CONFIRM_MS)
  }

  // 언마운트 때 타이머를 정리한다. 남겨두면 닫힌 모달의 setState가 뒤늦게 돈다.
  useEffect(() => clearConfirmTimer, [])

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

  /**
   * 좋아요 — 서버를 기다리지 않는다.
   *
   * POST가 왕복 7회(1281ms 실측). RDS가 us-east-1이라 그만큼은 구조적으로 든다.
   * 커뮤니티에서 가장 많이 눌리는 버튼을 1.3초 회색으로 두면 두 번 세 번 누르게 된다.
   * 그래서 하트를 즉시 뒤집고, 응답이 오면 서버가 준 수치로 맞추고, 실패하면 되돌린다.
   *
   * 요청이 하나 떠 있는 동안 들어온 탭은 무시한다(likePending). 서버 토글은 현재 DB
   * 상태를 보고 뒤집으므로 두 요청이 겹치면 어느 쪽이 이겼는지 알 수 없다.
   * 버튼을 disabled로 두지는 않는다 — 이미 뒤집혀 보이는 버튼이 회색이면 고장으로 읽힌다.
   */
  async function handleLike() {
    if (!post || likePending) return
    const before = { likedByMe: post.likedByMe, likeCount: post.likeCount }
    const next = !before.likedByMe

    setLikePending(true)
    setActionError(null)
    setPost((prev) =>
      prev
        ? { ...prev, likedByMe: next, likeCount: Math.max(0, prev.likeCount + (next ? 1 : -1)) }
        : prev,
    )

    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, { method: "POST" })
      const json = await res.json()
      if (json.error) {
        setPost((prev) => (prev ? { ...prev, ...before } : prev))
        setActionError(json.error.message)
        return
      }
      // 서버 수치로 맞춘다. 다른 사람이 그 사이에 누른 것도 여기서 반영된다
      setPost((prev) => (prev ? { ...prev, likedByMe: json.data.liked, likeCount: json.data.likeCount } : prev))
    } catch {
      setPost((prev) => (prev ? { ...prev, ...before } : prev))
      setActionError("네트워크 오류가 발생했어요. 좋아요를 되돌렸어요")
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
      // 위기 신호면 댓글이 **저장되지 않았다**(2026-08-25 결정 변경, _lib/crisis.ts).
      // 목록에 밀어 넣지 않는다 — 응답에 comment가 없어 undefined가 들어가고 렌더가 깨진다.
      // 입력도 지우지 않는다. 쓴 말이 사라지면 안내가 벌처럼 읽힌다.
      if (json.data.crisisBlocked) {
        setCrisisNotice(json.data.notice)
        return
      }

      setComments((prev) => [...prev, json.data.comment])
      setCommentBody("")
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev))
      setAffinityNotice(json.data.granted > 0 ? `친밀도 +${json.data.granted}` : "오늘 친밀도를 이미 다 받았어요")
      // 막지는 않았지만 걱정되는 신호가 있는 댓글(사별·보도·비유 등). 댓글은 달렸고 안내만 얹는다
      if (json.data.crisisNotice) setCrisisNotice(json.data.crisisNotice)
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
                {(post.isOwn || isAdmin) && (
                  <button
                    type="button"
                    // 본인 글이면 지금까지와 똑같이 바로 지운다. 확인은 남의 글일 때만이다.
                    onClick={post.isOwn ? handleDelete : () => setConfirmingDelete(true)}
                    disabled={deletePending || (!post.isOwn && confirmingDelete)}
                    className={post.isOwn ? "rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-60" : ADMIN_DELETE_POST}
                  >
                    {post.isOwn ? "삭제" : "관리자 삭제"}
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

            {!post.isOwn && isAdmin && (
              <div
                aria-hidden={!confirmingDelete}
                // max-h-96(384px)은 **안내 문구가 두 줄일 때 기준**이다. 그때 내용 높이가
                // py-4(32) + 패널 p-3·테두리(26) + 문구 2줄(약 40) + gap-2(8) + 버튼 줄(38)로
                // 약 144px이고, 닉네임이 길어 서너 줄이 되면 190px을 넘는다. 전에 쓰던
                // max-h-48(192px)이 딱 그 자리에서 버튼 아랫부분을 잘랐다 — EXPAND_BASE에
                // overflow-hidden이 있어서 넘친 만큼 그냥 사라진다. 짧은 닉네임으로는
                // 재현되지 않아 눈에 늦게 띄었다. 여유를 두 배로 잡는다.
                //
                // **height: auto로 바꾸지 마라.** 위 EXPAND_BASE 주석대로 이 구조는 높이와
                // 투명도를 함께 전환하려고 항상 렌더해 두고 max-h로 접는 것이고,
                // auto에는 transition이 걸리지 않아 접힘 애니메이션이 사라진다.
                className={
                  "px-7 " + EXPAND_BASE + " " + (confirmingDelete ? "max-h-96 py-4 opacity-100" : EXPAND_CLOSED)
                }
              >
                <div className={EXPAND_PANEL}>
                  {/* 닉네임을 넣는다. 남의 글이라는 사실이 문구에서 드러나야 한다 */}
                  <p className="text-xs leading-relaxed text-neutral-600">
                    {post.user.nickname} 님의 글입니다. 지우면 되돌릴 수 없어요.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={!confirmingDelete || deletePending}
                      className={BUTTON_BASE + " bg-red-500 text-white hover:bg-red-600"}
                    >
                      삭제하기
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={!confirmingDelete || deletePending}
                      className={QUIET_BUTTON}
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-7 py-6">
              <h2 className="mb-2 text-lg font-bold text-neutral-900">{post.title}</h2>
              <p className="mb-6 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">{post.body}</p>

              {/* 상세에서는 원본 비율 그대로 본다. 목록 카드만 16:9로 자른다(PostCard 주석 참고).
                  next/image를 쓰지 않는 이유는 미션 화면과 같다 — 설정에 없는 hostname이면 throw한다. */}
              {post.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.imageUrl}
                  alt="글에 첨부된 사진"
                  className="mb-6 h-auto w-full rounded-xl bg-neutral-100"
                />
              )}

              <button
                type="button"
                onClick={handleLike}
                aria-pressed={post.likedByMe}
                className={
                  "mb-7 rounded-full border px-5 py-2 text-sm font-semibold transition " +
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
                        {(comment.isOwn || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => {
                              // 본인 댓글은 지금까지와 똑같이 바로 지운다.
                              if (comment.isOwn) return handleDeleteComment(comment.id)
                              // 두 번째 누름이면 실행하고, 첫 번째면 확인 대기로 둔다.
                              if (confirmingCommentId === comment.id) {
                                clearConfirmTimer()
                                setConfirmingCommentId(null)
                                return handleDeleteComment(comment.id)
                              }
                              armCommentConfirm(comment.id)
                            }}
                            disabled={deletingCommentId === comment.id}
                            className={comment.isOwn ? "ml-auto rounded-lg border border-neutral-300 px-2 py-1 text-[11px] text-neutral-500 hover:bg-white disabled:opacity-60" : ADMIN_DELETE_COMMENT}
                          >
                            {comment.isOwn
                              ? "삭제"
                              : confirmingCommentId === comment.id
                                ? "정말 지울까요?"
                                : "관리자 삭제"}
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
              {/* 한 번 뜨면 내리지 않는다 — 다음 댓글을 쓰면 사라지는 안내는 정작 전화를
                  걸려던 순간에 화면에서 없어진다(ChatPanel과 같은 판단) */}
              {crisisNotice && <CrisisNotice message={crisisNotice} />}
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
