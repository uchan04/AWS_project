"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TRIBE } from "@/lib/types"
import { canWriteToGallery, type GalleryTab } from "../_lib/gallery"

export function WriteModal({ gallery }: { gallery: GalleryTab }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canWriteToGallery(gallery)) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-neutral-200 bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-400"
        >
          ✏️ 글 쓰기
        </button>
        <p className="text-xs text-neutral-400">전체 커뮤니티 글쓰기는 준비 중이에요</p>
      </div>
    )
  }

  const tribeColor = TRIBE[gallery].colorHex

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
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition"
        style={{ backgroundColor: tribeColor }}
      >
        ✏️ 글 쓰기
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" onClick={close}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">{TRIBE[gallery].animal} 갤러리에 글쓰기</h2>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            {/* TODO: Bedrock 주제 추천 — BEDROCK_MODEL_ID 확보 후 구현 (SPEC 8절) */}
            <div className="mb-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-400">
              주제 추천 준비 중이에요
            </div>

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
