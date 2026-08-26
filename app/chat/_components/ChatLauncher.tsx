"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { CHAT_BUBBLES } from "../_lib/bubbles"
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

  // 마운트된 프레임에 최종 상태를 칠하면 전환이 생기지 않는다. 한 프레임 뒤에 올린다.
  useEffect(() => {
    if (!bubble) return
    const frame = requestAnimationFrame(() => setBubbleShown(true))
    return () => cancelAnimationFrame(frame)
  }, [bubble])

  if (!diagnosed || !allowedPath(pathname)) return null

  // 패널이 열려 있는 동안에는 말풍선도 함께 사라진다 — 이미 말을 걸고 있는데 또 부를 이유가 없다.
  if (open) return <ChatPanel onClose={() => setOpen(false)} />

  // 크기: 2026-08-24 사용자 요청("챗봇 아이콘의 크기를 1.5배 더 키워줘", 펫 화면에서 봤다).
  // 이 버튼은 전역 오버레이라 네 화면(홈·미션·펫·커뮤니티)에서 함께 커진다 — 펫 화면만
  // 키우려면 펫 CSS에 예외를 두어야 하고, 그러면 화면을 옮길 때 아이콘 크기가 바뀌어
  // 보인다. 사용자가 네 화면 다 키우는 쪽으로 결정했다.
  // h-12/w-12(48px) → 4.5rem(72px), 이모지 text-xl(20px) → text-3xl(30px)로 둘 다 1.5배다
  // (원만 키우면 여백만 늘고, 이모지만 키우면 원에 꽉 찬다).
  // 챗봇은 D 담당이고 이 파일도 D의 것이다 — className 한 줄만 바꿨고 D에게 알린다.
  //
  // 머지(2026-08-24, C): develop이 같은 날 이 컴포넌트에 말풍선을 넣었다(c31f802).
  // **말풍선 구조는 develop 것을 그대로 쓰고, 크기만 위 결정대로 얹었다.** 말풍선은 D가
  // 만든 기능이고 크기는 사용자 요청이라 둘 중 하나를 버릴 이유가 없다. 바뀐 것은
  // 아래 버튼의 h-12 w-12 text-xl → h-[4.5rem] w-[4.5rem] text-3xl 한 줄뿐이고,
  // develop이 새로 넣은 shrink-0·바깥 div·gap-2는 손대지 않았다
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
        className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-white text-3xl shadow-lg transition hover:bg-neutral-50"
      >
        💬
      </button>
    </div>
  )
}
