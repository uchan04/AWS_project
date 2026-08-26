"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { CHAT_BUBBLES } from "../_lib/bubbles"
import { CHAT_OPEN_EVENT } from "../_lib/events"
import { ChatPanel } from "./ChatPanel"

// 챗봇 버튼을 띄우는 화면. 홈·미션·키우기·커뮤니티 네 곳만이다(2026-08-21 확정 흐름).
// 소개·가입·로그인·진단 문항·진단 결과는 홈에 닿기 전 화면이라 챗봇이 없어야 한다.
// 숨길 경로를 나열하는 방식이었으나 화면이 늘 때마다 빠뜨려서 허용 목록으로 뒤집었다.
// /pet/skins·/pet/cosmetics처럼 하위 경로가 있으므로 접두사로 본다("/"만 정확히 일치).
const ALLOWED_PREFIXES = ["/missions", "/pet", "/community"]

// 말풍선이 뜨기까지 기다리는 시간. 화면이 뜨자마자 튀어나오면 말을 거는 게 아니라 방해가 된다.
const BUBBLE_DELAY_MS = 2000

function allowedPath(pathname: string) {
  return pathname === "/" || ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

// layout.tsx는 서버 컴포넌트라 useState를 쓸 수 없다. 열림 상태를 이 래퍼가 대신 갖는다.
// 챗봇은 Sidebar 탭이 아니라 전역 오버레이다(시안 기준) — 허용된 화면에서 우상단 버튼으로 연다.
// 경로만으로는 소개 화면과 홈이 갈리지 않는다 — 둘 다 "/"이고 진단 여부로 나뉜다.
// 진단을 마치지 않았으면(미인증 포함) 아직 홈이 아니므로 버튼을 띄우지 않는다.
// diagnosed는 layout.tsx가 서버에서 읽어 넘긴다(2026-08-21 A 수정, D 통보).
// 전에는 여기서 /api/diagnosis/me를 usePathname deps로 불러서 탭을 옮길 때마다
// 요청이 하나 더 나갔다 — 한국에서 us-east-1까지 왕복 178ms짜리다.
export function ChatLauncher({ diagnosed }: { diagnosed: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [bubbleShown, setBubbleShown] = useState(false)
  // 닫으면 이 화면을 떠날 때까지 다시 뜨지 않는다. localStorage에 남기지 않는다 —
  // 한 번 닫은 것을 영구히 기억하면 다음에 다시 왔을 때 말을 걸 길이 없어진다.
  const [dismissed, setDismissed] = useState(false)

  // 문구는 이 컴포넌트가 살아 있는 동안 한 번만 고른다. 패널을 열고 닫아도 그대로다 —
  // 열 때마다 문구가 바뀌면 말을 거는 게 아니라 화면이 산만해진다.
  // Math.random()은 렌더 중에 부를 수 없어(react-hooks의 impure function 규칙) 타이머 안에서 고른다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBubble(CHAT_BUBBLES[Math.floor(Math.random() * CHAT_BUBBLES.length)])
    }, BUBBLE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  // **밖에서 여는 창구** (2026-08-26 사용자 요청, A 구현 — D 통보).
  // 펫 화면이 자기 HUD에 챗봇 버튼을 갖게 되면서 필요해졌다. 이벤트로 둔 이유는
  // `_lib/events.ts` 주석에 있다 — 요약하면 layout.tsx가 서버 컴포넌트라 상태를 못 들고,
  // 그래서 이 래퍼가 상태를 갖고 있는 구조 자체가 props 전달을 막는다.
  //
  // 이 컴포넌트가 안 그려지는 화면(진단 전·허용 목록 밖)에서는 리스너도 없으므로
  // 이벤트를 쏴도 아무 일이 없다 — 그쪽이 맞다. 챗봇이 없어야 하는 화면이다.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(CHAT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(CHAT_OPEN_EVENT, onOpen)
  }, [])

  // 마운트된 프레임에 최종 상태를 칠하면 전환이 생기지 않는다. 한 프레임 뒤에 올린다.
  useEffect(() => {
    if (!bubble) return
    const frame = requestAnimationFrame(() => setBubbleShown(true))
    return () => cancelAnimationFrame(frame)
  }, [bubble])

  if (!diagnosed || !allowedPath(pathname)) return null

  // 패널이 열려 있는 동안에는 말풍선도 함께 사라진다 — 이미 말을 걸고 있는데 또 부를 이유가 없다.
  if (open) return <ChatPanel onClose={() => setOpen(false)} />

  // **`/pet`에서는 떠 있는 버튼과 말풍선을 감춘다** (2026-08-26 사용자 요청).
  // 그 화면이 챗봇 버튼을 자기 HUD(우측 스택)에 갖고 있어서 두 벌이 되고, 전역 오버레이가
  // `fixed top-4 right-4`라 좁은 화면에서 페이지 머리("나의 펫")를 덮는 문제도 있었다
  // (C가 2026-08-26 기록에 "이번 변경과 무관한 기존 상태이고 D 파일이다"로 남긴 것).
  //
  // **위 리스너보다 아래에 둔다.** 감추는 것은 버튼뿐이고 패널은 그대로 열린다 —
  // 이 return이 리스너 등록보다 위에 오면 훅이 조건부로 호출돼 규칙 위반이다.
  //
  // 정확히 "/pet"만이다. `/pet/skins`·`/pet/cosmetics`·`/pet/rest`에는 HUD가 없으므로
  // 접두사로 감추면 그 세 화면에서 챗봇에 닿을 길이 사라진다.
  if (pathname === "/pet") return null

  // 크기: **2026-08-26 사용자 요청으로 1.5배를 되돌렸다.** h-12 w-12 text-xl(48px·20px)이
  // 원래 값이고 D가 쓴 그대로다.
  //
  // 내력: 2026-08-24에 사용자 요청("챗봇 아이콘의 크기를 1.5배 더 키워줘")으로
  // h-[4.5rem] w-[4.5rem] text-3xl(72px·30px)로 키웠다(08c054e). 전역 오버레이라 네 화면
  // (홈·미션·펫·커뮤니티)이 함께 커졌고, 같은 사용자가 08-26에 되돌리기로 결정했다.
  // **되돌린 것은 이 className 한 줄뿐이다** — develop이 같은 날 넣은 말풍선 구조
  // (c31f802의 바깥 div·gap-2·shrink-0)는 그때도 손대지 않았고 지금도 그대로다.
  //
  // 챗봇은 D 담당이고 이 파일도 D의 것이다 — 키울 때도 되돌릴 때도 D에게 알린다.
  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
      {bubble && !dismissed && (
        // 버튼 왼쪽에 붙는다. 나타날 때 버튼 쪽에서 밀려나오도록 오른쪽에서 들어온다.
        <div
          className={
            "flex items-center gap-0.5 rounded-2xl bg-white py-1.5 pr-1.5 pl-3.5 shadow-lg transition duration-200 ease-out " +
            (bubbleShown ? "" : "motion-safe:translate-x-2 motion-safe:opacity-0")
          }
        >
          {/* 말풍선 본문 자체가 여는 버튼이다. 닫기 ✕와 겹치지 않게 형제로 나란히 둔다
              (버튼 안에 버튼을 넣으면 유효한 마크업이 아니다). */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm whitespace-nowrap text-neutral-700 transition duration-150 hover:text-neutral-900"
          >
            {bubble}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="말풍선 닫기"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-neutral-400 transition duration-150 hover:bg-neutral-100 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="마음 친구 열기"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-lg transition hover:bg-neutral-50"
      >
        💬
      </button>
    </div>
  )
}
