"use client"

import { useEffect, useRef, useState } from "react"
import { useModalA11y } from "@/app/components/useModalA11y"
import type { TypeCode } from "@prisma/client"
import { TRIBE, withSubject } from "@/lib/types"
import { timeAgo } from "@/app/community/_lib/format"
import { POST_AFFINITY, COMMENT_AFFINITY, CHAT_TURN_AFFINITY } from "@/app/community/_lib/affinity"
import { CHAT_STARTERS } from "@/app/chat/_lib/starters"
import { isCrisis, CRISIS_HOTLINE, CRISIS_HOTLINE_LABEL } from "@/lib/safety"
import { CrisisNotice } from "@/app/components/CrisisNotice"

const NEUTRAL_COLOR = "#9CA3AF"

// 스트림 실패 문구에 상담 번호를 함께 둔다. 이 문구가 뜨는 순간은 방금 무언가를
// 털어놓고 아무 답도 받지 못한 순간이고, lib/safety.ts의 정규식이 놓친 표현이었다면
// 여기가 마지막 안내 지점이다.
// 대화 이력 로딩 실패에는 붙이지 않는다 — 그때는 아직 아무것도 말하지 않은 상태다.
const STREAM_FAIL_MESSAGE = `답장을 만들지 못했어요. 잠시 후 다시 시도해 주세요. 혼자 견디기 어려운 순간이라면 ${CRISIS_HOTLINE_LABEL} ${CRISIS_HOTLINE}은 24시간 전화를 받아요.`

// 유형별 6개 중 3개를 무작위로 골라 반환한다. lodash 등 외부 라이브러리를 쓰지 않는다.
function pickThreeStarters(typeCode: TypeCode): string[] {
  const shuffled = [...CHAT_STARTERS[typeCode]]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 3)
}

type ChatMessageDTO = {
  id: string
  role: "USER" | "ASSISTANT"
  content: string
  createdAt: string
}

export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([])
  const [affinityToday, setAffinityToday] = useState(0)
  // 전역 오버레이라 props를 넘겨줄 서버 컴포넌트가 없다. 아래 GET 하나로 같이 받는다.
  const [nickname, setNickname] = useState("")
  const [typeCode, setTypeCode] = useState<TypeCode | null>(null)
  const [bedrockConfigured, setBedrockConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 401이면 진단 안내가 아니라 로그인 안내를 띄우고 입력을 막는다
  const [unauthorized, setUnauthorized] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  // 서버가 위기 신호로 판정한 뒤로는 전화 카드를 계속 띄운다(내리지 않는다)
  const [crisis, setCrisis] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  // 패널이 새로 마운트될 때(재진입 시) 한 번만 뽑는다. typeCode가 GET으로 채워진 뒤에야
  // 뽑을 수 있으므로 아래 GET 성공 시점에 한 번만 계산한다(리렌더마다 다시 섞이지 않는다).
  const [starters, setStarters] = useState<string[]>([])
  const listEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Escape로 닫기 · 초점 가두기 · 닫을 때 열었던 버튼으로 초점 되돌리기.
  // onClose가 없으면(전체 화면으로 쓰는 경우) 배경도 없으니 가두지 않는다.
  // 초점은 입력창으로 보낸다 — 채팅 패널을 열었다는 것은 곧 쓰겠다는 뜻이다
  const panelRef = useModalA11y(() => onClose?.(), Boolean(onClose), inputRef)

  const accentColor = typeCode ? TRIBE[typeCode].colorHex : NEUTRAL_COLOR

  useEffect(() => {
    let ignore = false

    fetch("/api/chat/messages")
      .then((res) => res.json())
      .then((json) => {
        if (ignore) return
        if (json.error) {
          if (json.error.code === "UNAUTHORIZED") setUnauthorized(true)
          setError(json.error.message)
          return
        }
        setMessages(json.data.messages)
        setAffinityToday(json.data.affinityToday)
        setNickname(json.data.nickname)
        setTypeCode(json.data.typeCode)
        setBedrockConfigured(json.data.bedrockConfigured)
        if (json.data.typeCode) setStarters(pickThreeStarters(json.data.typeCode))
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
  }, [messages, streaming, streamingText])

  // sent = 방금 보낸 사용자 발화. 위기 신호 판정에만 쓴다.
  async function streamAssistantReply(sent: string) {
    // Bedrock이 연결되지 않은 환경에서도 위기 응답은 내보낸다. 라우트가 모델 호출 전에
    // 고정 문구로 답하도록 되어 있으므로(app/api/chat/stream/route.ts) 여기서 끊으면 안 된다
    if (!bedrockConfigured && !isCrisis(sent)) return

    setStreaming(true)
    setStreamingText("")
    try {
      const res = await fetch("/api/chat/stream", { method: "POST" })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null)
        setError(json?.error?.message ?? STREAM_FAIL_MESSAGE)
        return
      }

      // 서버가 위기로 판정하면 전화 카드를 띄운다. 본문을 파싱하지 않고 헤더로 받는다.
      // 한 번 켜지면 이 세션 동안 내려가지 않는다 — 다음 메시지를 보냈다고 사라지면
      // 정작 전화를 걸려던 순간에 번호가 화면에서 없어진다
      if (res.headers.get("X-Crisis") === "1") setCrisis(true)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setStreamingText(full)
      }

      // 끝까지 정상 수신됐을 때만 화면에 반영한다. 중간에 끊긴 응답은 버린다 —
      // 서버도 같은 조건(스트림 정상 종료)에서만 저장하므로 화면과 DB 상태가 어긋나지 않는다.
      if (full.trim()) {
        setMessages((prev) => [
          ...prev,
          { id: `stream-${Date.now()}`, role: "ASSISTANT", content: full, createdAt: new Date().toISOString() },
        ])
      }
    } catch {
      setError(STREAM_FAIL_MESSAGE)
    } finally {
      setStreaming(false)
      setStreamingText("")
    }
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim()
    if (!trimmed || sending || streaming || !typeCode) return

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
      window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } finally {
      setSending(false)
    }

    streamAssistantReply(trimmed)
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

      <div
        ref={panelRef}
        role="dialog"
        aria-modal={onClose ? "true" : undefined}
        aria-label="마음 친구와 대화"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-[460px] flex-col bg-white shadow-2xl"
      >
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
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
              aria-label="닫기"
            >
              ✕
            </button>
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
            <p role="status" aria-live="polite" className="py-10 text-center text-sm text-neutral-400">
              불러오는 중...
            </p>
          ) : unauthorized ? null : messages.length === 0 ? (
            <div className="flex flex-col gap-5 py-6">
              <div>
                <p className="text-base font-bold text-neutral-900">안녕하세요, {nickname}</p>
                <p className="mt-1 text-sm text-neutral-500">오늘 어떤 하루를 보내셨나요?</p>
              </div>
              {typeCode && (
                <div className="flex flex-col gap-2">
                  {starters.map((text) => (
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
                    {/* whitespace-pre-wrap: Shift+Enter로 넣은 줄바꿈이 그대로 보여야 한다.
                        없으면 여러 줄로 쓴 말이 한 덩어리로 뭉친다 */}
                    <div
                      className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap text-white"
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
                      {/* 위기 고정 응답(lib/safety.ts CRISIS_REPLY)은 상담 번호를 빈 줄로
                          띄워 한 줄에 세운다. pre-wrap이 없으면 그 줄이 문장 속에 묻힌다 */}
                      <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 text-sm whitespace-pre-wrap text-neutral-800">
                        {message.content}
                      </div>
                      <span className="mt-1 text-[11px] text-neutral-400">{timeAgo(new Date(message.createdAt))}</span>
                    </div>
                  </div>
                )
              )}
              {streaming && (
                <div className="flex items-start gap-2">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-neutral-200" />
                  <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 text-sm whitespace-pre-wrap text-neutral-800">
                    {streamingText ? (
                      streamingText
                    ) : (
                      // 점 3개만 있던 자리다. Bedrock 첫 토큰까지 2~4초가 걸려서 그동안
                      // 화면이 "멈춘 것"으로 읽혔다. 종족 이름을 써 기다리는 대상을 밝힌다.
                      // 동물명은 TRIBE가 정본이다 — typeCode.includes()로 분기하지 않는다
                      // (유형 코드가 늘면 조용히 "고양이"로 떨어진다)
                      <div className="py-1">
                        <div className="flex gap-1">
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                        {typeCode ? (
                          <p className="mt-1.5 text-[11px] text-neutral-500">
                            {withSubject(TRIBE[typeCode].animal)} 당신의 이야기에 고개를 끄덕이고
                            있어요…
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={listEndRef} />
            </div>
          )}
        </div>

        {/* 스크린리더 전용 알림.
            스트리밍 텍스트 자체에 aria-live를 걸면 토큰이 올 때마다 지금까지의 답 전체를
            다시 읽어 대화가 불가능해진다. 그래서 쓰는 중에는 "쓰고 있어요"만 알리고,
            끝난 뒤 마지막 답을 한 번 읽는다.
            이 요소는 항상 DOM에 있어야 한다 — 내용이 바뀔 때 새로 생기는 live region은
            브라우저가 읽지 않는 경우가 있다 */}
        <p className="sr-only" role="status" aria-live="polite">
          {streaming
            ? "답장을 쓰고 있어요"
            : messages[messages.length - 1]?.role === "ASSISTANT"
              ? messages[messages.length - 1].content
              : ""}
        </p>

        <div className="border-t border-neutral-200 px-5 py-4">
          {!loading && !bedrockConfigured && !unauthorized && (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              개발 모드 · AI 응답은 아직 연결되지 않았어요
            </p>
          )}

          {crisis && (
            <CrisisNotice className="mb-3" message="혼자 감당하지 않아도 괜찮아요. 24시간 전화를 받는 곳이 있어요." />
          )}

          {error && (
            <p role="alert" className="mb-2 text-xs leading-relaxed text-red-600">
              {error}
            </p>
          )}

          {unauthorized ? (
            <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
              로그인해야 마음 친구와 대화할 수 있어요
            </p>
          ) : !typeCode ? (
            <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
              진단을 먼저 완료해야 마음 친구와 대화할 수 있어요
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="오늘 하루는 어땠나요?"
                aria-label="보낼 말"
                rows={1}
                className="max-h-32 flex-1 resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={sending || streaming || !input.trim()}
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
