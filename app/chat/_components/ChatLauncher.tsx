"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { ChatPanel } from "./ChatPanel"

// layout.tsx는 서버 컴포넌트라 useState를 쓸 수 없다. 열림 상태를 이 래퍼가 대신 갖는다.
// 챗봇은 Sidebar 탭이 아니라 전역 오버레이다(시안 기준) — 어느 화면에서든 우상단 버튼으로 연다.

// 런처를 숨기는 경로.
// /diagnosis — 문항 몰입을 깨지 않기 위해. Sidebar도 같은 경로에서 같은 방식으로 숨는다.
// /login, /signup — 미인증 상태라 패널을 열어도 /api/chat/messages가 401만 낸다.
//   (auth)는 라우트 그룹이라 URL에 나타나지 않는다 — 실제 경로가 /login·/signup이다.
const HIDDEN_PATHS = ["/diagnosis", "/login", "/signup"]

export function ChatLauncher() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (HIDDEN_PATHS.includes(pathname)) return null

  if (open) return <ChatPanel onClose={() => setOpen(false)} />

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="마음 친구 열기"
      className="fixed top-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-lg transition hover:bg-neutral-50"
    >
      💬
    </button>
  )
}
