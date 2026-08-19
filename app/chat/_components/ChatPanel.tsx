"use client"

import { useEffect, useRef, useState } from "react"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { timeAgo } from "@/app/community/_lib/format"
import { POST_AFFINITY, COMMENT_AFFINITY, CHAT_TURN_AFFINITY } from "@/app/community/_lib/affinity"

const NEUTRAL_COLOR = "#9CA3AF"

// 정적 상수다. LLM이 만든 추천이 아니다.
const SUGGESTIONS = [
  "오늘 있었던 일을 이야기하고 싶어요",
  "그냥 마음이 좀 복잡해요",
  "특별한 일은 없었지만 기록해두고 싶어요",
]

type ChatMessageDTO = {
  id: string
  role: "USER" | "ASSISTANT"
  content: string
  createdAt: string
}

export function ChatPanel({
  nickname,
  typeCode,
  bedrockConfigured,
  onClose,
}: {
  nickname: string
  typeCode: TypeCode | null
  bedrockConfigured: boolean
  onClose?: () => void
}) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([])
  const [affinityToday, setAffinityToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const listEndRef = useRef<HTMLDivElement>(null)

  const accentColor = typeCode ? TRIBE[typeCode].colorHex : NEUTRAL_COLOR

  useEffect(() => {
    let ignore = false

    fetch("/api/chat/messages")
      .then((res) => res.json())
      .then((json) => {
        if (ignore) return
        if (json.error) {
          setError(json.error.message)
          return
        }
        setMessages(json.data.messages)
        setAffinityToday(json.data.affinityToday)
      })
      .catch(() => {
        if (!ignore) setError("대화 이력을 불러오지 못했어요")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  async function sendMessage(content: string) {
    const trimmed = content.trim()
    if (!trimmed || sending || !typeCode) return

    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
        return
      }
      setMessages((prev) => [...prev, json.data.message])
      // 서버가 이미 상한을 적용한 값이라 여기서 다시 min(100, ...)을 계산하지 않는다.
      setAffinityToday((prev) => prev + json.data.granted)
      setInput("")
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {onClose && <div className="absolute inset-0 bg-black/30" onClick={onClose} />}

      <div className="absolute inset-y-0 right-0 flex w-[460px] flex-col bg-white shadow-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-neutral-900">마음 친구</p>
              <p className="truncate text-xs text-neutral-500">공감과 경청만 해요 · 친밀도 {affinityToday}/100</p>
            </div>
            <button
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-neutral-400 hover:bg-neutral-100"
              aria-label="친밀도 안내"
            >
              ℹ
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
                aria-label="닫기"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, affinityToday)}%`, backgroundColor: accentColor }}
            />
          </div>

          {infoOpen && (
            <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-xs text-neutral-600">
              <p className="mb-2 font-semibold text-neutral-800">친밀도는 이렇게 쌓여요</p>
              <ul className="mb-3 flex flex-col gap-1">
                <li>챗봇 대화 1턴 +{CHAT_TURN_AFFINITY}</li>
                <li>커뮤니티 글 작성 +{POST_AFFINITY}</li>
                <li>댓글 달기 +{COMMENT_AFFINITY}</li>
              </ul>
              <p className="mb-2 font-semibold text-neutral-800">마음 친구의 원칙</p>
              <ul className="flex flex-col gap-1">
                <li>공감과 경청에만 집중해요</li>
                <li>조언이나 해결책을 제시하지 않아요</li>
                <li>판단하지 않아요</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-neutral-400">불러오는 중...</p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col gap-5 py-6">
              <div>
                <p className="text-base font-bold text-neutral-900">안녕하세요, {nickname}</p>
                <p className="mt-1 text-sm text-neutral-500">오늘 어떤 하루를 보내셨나요?</p>
              </div>
              {typeCode && (
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => setInput(text)}
                      className="rounded-xl border border-neutral-200 px-4 py-2.5 text-left text-sm text-neutral-600 hover:bg-neutral-50"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) =>
                message.role === "USER" ? (
                  <div key={message.id} className="flex flex-col items-end">
                    <div
                      className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white"
                      style={{ backgroundColor: accentColor }}
                    >
                      {message.content}
                    </div>
                    <span className="mt-1 text-[11px] text-neutral-400">{timeAgo(new Date(message.createdAt))}</span>
                  </div>
                ) : (
                  <div key={message.id} className="flex items-start gap-2">
                    <div className="h-7 w-7 shrink-0 rounded-full bg-neutral-200" />
                    <div className="flex flex-col items-start">
                      <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 text-sm text-neutral-800">
                        {message.content}
                      </div>
                      <span className="mt-1 text-[11px] text-neutral-400">{timeAgo(new Date(message.createdAt))}</span>
                    </div>
                  </div>
                )
              )}
              <div ref={listEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 px-5 py-4">
          {!bedrockConfigured && (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              개발 모드 · AI 응답은 아직 연결되지 않았어요
            </p>
          )}

          {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

          {!typeCode ? (
            <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
              진단을 먼저 완료해야 마음 친구와 대화할 수 있어요
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="오늘 하루는 어땠나요?"
                rows={1}
                className="max-h-32 flex-1 resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={sending || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
                style={{ backgroundColor: accentColor }}
                aria-label="전송"
              >
                ➤
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
