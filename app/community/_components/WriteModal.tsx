"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { useModalA11y } from "@/app/components/useModalA11y"
import { type GalleryTab } from "../_lib/gallery"
import { TOPICS, type WriteTopic } from "../_lib/topics"
import { TITLE_MAX, BODY_MAX, remaining } from "../_lib/limits"

// 전체 갤러리는 종족이 없어 TRIBE에 키가 없다. lib/types.ts는 A 소유 공유 파일이라
// 건드리지 않고, ChatPanel이 NEUTRAL_COLOR를 자기 파일에 둔 것과 같은 방식으로 여기 둔다.
const NEUTRAL_COLOR = "#9CA3AF"

// 고정 문구 6개 중 3개를 무작위로 고른다. LLM 추천이 실패했을 때의 대비책이다 —
// 추천이 없어도 글은 쓸 수 있어야 하므로 실패를 오류 문구로 만들지 않는다.
// ChatPanel의 pickThreeStarters()와 같은 방식이며 외부 라이브러리를 쓰지 않는다.
function pickThreeTopics(typeCode: TypeCode): WriteTopic[] {
  const shuffled = [...TOPICS[typeCode]]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 3)
}

/**
 * @param myTypeCode 내 종족. 갤러리(gallery)와 다르다 — 전체 탭에서도 추천은 내 성향으로 뽑는다.
 *   진단 전이면 null이고, 그때는 추천 영역을 그리지 않는다.
 */
export function WriteModal({ gallery, myTypeCode }: { gallery: GalleryTab; myTypeCode: TypeCode | null }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 모달을 열 때 정한다. 입력 중에는 목록이 바뀌지 않는다.
  const [topics, setTopics] = useState<WriteTopic[]>([])
  const [topicsLoading, setTopicsLoading] = useState(false)
  // LLM 추천을 한 번 받으면 이 페이지에 머무는 동안 다시 부르지 않는다.
  // 열 때마다 Bedrock을 부르면 글 하나 쓰려고 창을 여닫는 것만으로 호출이 쌓인다.
  const cachedRef = useRef<WriteTopic[] | null>(null)

  const isAll = gallery === "ALL"
  const tribeColor = isAll ? NEUTRAL_COLOR : TRIBE[gallery].colorHex

  // 주제 추천(SPEC 8절). 실패·빈 응답이면 고정 문구로 되돌아간다.
  // 진단 전(myTypeCode === null)이면 추천할 성향이 없어 아무것도 부르지 않는다.
  function loadTopics() {
    if (!myTypeCode) return setTopics([])
    if (cachedRef.current) return setTopics(cachedRef.current)

    // 기다리는 동안에도 고정 문구를 먼저 보여준다. 빈 자리를 두면 창이 열린 뒤
    // 추천 영역이 나중에 끼어들어 제목 칸이 아래로 밀린다(레이아웃 이동)
    const fallback = pickThreeTopics(myTypeCode)
    setTopics(fallback)
    setTopicsLoading(true)

    fetch("/api/community/topics")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const next = json?.data?.topics
        if (Array.isArray(next) && next.length > 0) {
          cachedRef.current = next
          setTopics(next)
        }
      })
      .catch(() => {
        // 고정 문구가 이미 떠 있다. 따로 알리지 않는다
      })
      .finally(() => setTopicsLoading(false))
  }

  function close() {
    setIsOpen(false)
    setTitle("")
    setBody("")
    setError(null)
  }

  // Escape로 닫기 · 초점 가두기 · 닫을 때 "글 쓰기" 버튼으로 초점 되돌리기.
  // 초점은 제목 칸으로 보낸다 — 기본값이면 ✕ 버튼에 가서 열자마자 닫기가 눌리기 쉽다
  const titleRef = useRef<HTMLInputElement>(null)
  const boxRef = useModalA11y(close, isOpen, titleRef)

  async function handleSubmit() {
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle || !trimmedBody || pending) return

    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle, body: trimmedBody, galleryType: gallery }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
        return
      }
      close()
      router.refresh()
      window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          loadTopics()
          setIsOpen(true)
        }}
        // 배경이 종족 색(인라인)이라 hover:bg-*로는 못 건드린다. 색과 무관한 그림자·이동·축소로 반응을 만든다.
        // 이동·확대만 motion-safe:로 감싼다 — prefers-reduced-motion에서도 그림자는 남아야 무엇을 누르는지 보인다.
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-150 hover:shadow-lg focus-visible:shadow-lg focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none active:shadow-sm motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.02] motion-safe:focus-visible:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]"
        style={{ backgroundColor: tribeColor }}
      >
        ✏️ 글 쓰기
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" onClick={close}>
          <div
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="write-modal-title"
            tabIndex={-1}
            className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="write-modal-title" className="text-base font-bold text-neutral-900">
                {isAll ? "전체 커뮤니티에 글쓰기" : `${TRIBE[gallery].animal} 갤러리에 글쓰기`}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="글쓰기 창 닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            {/* 주제 추천(SPEC 8절). GET /api/community/topics가 Bedrock으로 만든다.
                실패하면 고정 문구(`_lib/topics.ts`)가 그대로 남는다.
                진단 전이면 topics가 비어 있고, 그때는 영역 자체를 렌더하지 않는다. */}
            {topics.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs text-neutral-400" role="status" aria-live="polite">
                  {topicsLoading ? "오늘 쓸 만한 이야기를 찾고 있어요…" : "선택하면 제목과 본문이 채워져요"}
                </p>
                <div className="flex flex-col gap-2">
                  {topics.map((topic) => (
                    <button
                      key={topic.title}
                      type="button"
                      onClick={() => {
                        setTitle(topic.title)
                        setBody(topic.draft)
                      }}
                      // 세로로 나열되므로 이동 효과는 넣지 않는다. 테두리 색만 진해져 "고를 수 있는 것"임을 드러낸다.
                      className="rounded-xl border border-neutral-200 px-4 py-2.5 text-left transition duration-150 hover:border-neutral-400 hover:bg-neutral-50 focus-visible:border-neutral-400 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <span className="block text-sm font-semibold" style={{ color: tribeColor }}>
                        {topic.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{topic.draft}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* placeholder는 접근 가능한 이름이 아니다 — 입력하면 사라져 무슨 칸인지 알 수 없다 */}
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력해주세요"
              aria-label="제목"
              // maxLength는 UX다. 실제 거절은 서버(app/api/community/posts/route.ts)가 한다
              maxLength={TITLE_MAX}
              className="mb-1 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-500"
            />
            {/* 제목은 100자를 쓸 일이 드물어 20자 남았을 때만 띄운다 — 늘 띄우면 잔소리가 된다 */}
            <p className="mb-2 h-4 text-right text-xs text-neutral-400">
              {remaining(title, TITLE_MAX) <= 20 ? `${title.length} / ${TITLE_MAX}자` : ""}
            </p>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"오늘 있었던 일, 느낀 것을 이야기해봐요\n여기선 뭐든 괜찮아요."}
              aria-label="본문"
              rows={6}
              maxLength={BODY_MAX}
              className="mb-1 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-500"
            />
            {/* 본문은 길게 쓰다가 잘리면 놀란다. 늘 띄우고 200자 남으면 색을 바꾼다 */}
            <p
              className={`mb-3 text-right text-xs ${
                remaining(body, BODY_MAX) <= 200 ? "text-amber-600" : "text-neutral-400"
              }`}
              aria-live="polite"
            >
              {body.length} / {BODY_MAX}자
            </p>

            {error && (
              <p role="alert" className="mb-3 text-xs text-red-500">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !title.trim() || !body.trim()}
                className="rounded-xl px-6 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: tribeColor }}
              >
                게시하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
