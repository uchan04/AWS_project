"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ChatPanel } from "./ChatPanel"

// 챗봇 버튼을 띄우는 화면. 홈·미션·키우기·커뮤니티 네 곳만이다(2026-08-21 확정 흐름).
// 소개·가입·로그인·진단 문항·진단 결과는 홈에 닿기 전 화면이라 챗봇이 없어야 한다.
// 숨길 경로를 나열하는 방식이었으나 화면이 늘 때마다 빠뜨려서 허용 목록으로 뒤집었다.
// /pet/skins·/pet/cosmetics처럼 하위 경로가 있으므로 접두사로 본다("/"만 정확히 일치).
const ALLOWED_PREFIXES = ["/missions", "/pet", "/community"]

function allowedPath(pathname: string) {
  return pathname === "/" || ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

// layout.tsx는 서버 컴포넌트라 useState를 쓸 수 없다. 열림 상태를 이 래퍼가 대신 갖는다.
// 챗봇은 Sidebar 탭이 아니라 전역 오버레이다(시안 기준) — 허용된 화면에서 우상단 버튼으로 연다.
export function ChatLauncher() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)

  // 경로만으로는 소개 화면과 홈이 갈리지 않는다 — 둘 다 "/"이고 진단 여부로 나뉜다.
  // 진단을 마치지 않았으면(미인증 포함) 아직 홈이 아니므로 버튼을 띄우지 않는다.
  useEffect(() => {
    let alive = true
    fetch("/api/diagnosis/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (alive) setReady(Boolean(body?.data))
      })
      .catch(() => {
        // 못 읽었으면 띄우지 않는다. 진단 전 화면에 챗봇이 뜨는 쪽이 더 나쁘다
        if (alive) setReady(false)
      })
    return () => {
      alive = false
    }
  }, [pathname])

  if (!ready || !allowedPath(pathname)) return null

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
