"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { ChatPanel } from "./ChatPanel"

// layout.tsx는 서버 컴포넌트라 useState를 쓸 수 없다. 열림 상태를 이 래퍼가 대신 갖는다.
// 챗봇은 Sidebar 탭이 아니라 전역 오버레이다(시안 기준) — 어느 화면에서든 우상단 버튼으로 연다.
export function ChatLauncher() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // 진단 문항 화면에서는 숨긴다. Sidebar도 같은 경로에서 같은 방식으로 숨는다.
  // 별도의 로그인 라우트는 아직 없다(app/(auth)/ 미생성) — 생기면 여기에 함께 추가한다.
  if (pathname === "/diagnosis") return null

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
