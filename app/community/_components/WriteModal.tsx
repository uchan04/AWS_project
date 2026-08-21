"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { type GalleryTab } from "../_lib/gallery"
import { TOPICS, type WriteTopic } from "../_lib/topics"

// 전체 갤러리는 종족이 없어 TRIBE에 키가 없다. lib/types.ts는 A 소유 공유 파일이라
// 건드리지 않고, ChatPanel이 NEUTRAL_COLOR를 자기 파일에 둔 것과 같은 방식으로 여기 둔다.
const NEUTRAL_COLOR = "#9CA3AF"

// 6개 중 3개를 무작위로 고른다. ChatPanel의 pickThreeStarters()와 같은 방식이며
// 외부 라이브러리를 쓰지 않는다.
function pickThreeTopics(typeCode: TypeCode): WriteTopic[] {
  const shuffled = [...TOPICS[typeCode]]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 3)
}

export function WriteModal({ gallery }: { gallery: GalleryTab }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 모달을 열 때 한 번만 고른다. 입력 중에는 목록이 바뀌지 않는다.
  const [topics, setTopics] = useState<WriteTopic[]>([])

  const isAll = gallery === "ALL"
  const tribeColor = isAll ? NEUTRAL_COLOR : TRIBE[gallery].colorHex

  function close() {
    setIsOpen(false)
    setTitle("")
    setBody("")
    setError(null)
  }

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
      window.dispatchEvent(new CustomEvent("mission-completed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // 전체 탭은 유형을 알 수 없어 추천을 띄우지 않는다(TOPICS에 ALL 키가 없다).
          setTopics(isAll ? [] : pickThreeTopics(gallery))
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
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">
                {isAll ? "전체 커뮤니티에 글쓰기" : `${TRIBE[gallery].animal} 갤러리에 글쓰기`}
              </h2>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            {/* 주제 추천(SPEC 8절). 지금은 고정 문구이며 `_lib/topics.ts`가 유일한 출처다.
                전체 탭은 typeCode를 알 수 없어 topics가 비어 있고, 그때는 영역 자체를 렌더하지 않는다. */}
            {topics.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs text-neutral-400">선택하면 제목과 본문이 채워져요</p>
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

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력해주세요"
              className="mb-3 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-neutral-500"
            />

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"오늘 있었던 일, 느낀 것을 이야기해봐요\n여기선 뭐든 괜찮아요."}
              rows={6}
              className="mb-4 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm leading-relaxed outline-none focus:border-neutral-500"
            />

            {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

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
