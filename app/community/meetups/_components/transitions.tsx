"use client"

import { useEffect, useState, type ReactNode } from "react"

// 모임 화면의 카드·모달이 함께 쓰는 전환 조각. 새 CSS 파일 없이 Tailwind 유틸리티만 쓴다.
// 움직임은 전부 motion-safe:로 감싼다 — prefers-reduced-motion을 켠 사용자에게는
// 최종 상태가 그대로 보이고 아무것도 움직이지 않는다(PostCard.tsx와 같은 규칙).

/**
 * 마운트 직후 opacity를 올려 나타남을 만든다.
 * 같은 자리에서 내용이 바뀔 때는 key를 함께 바꿔야 다시 마운트되어 전환이 보인다
 * (React가 같은 위치·같은 타입이면 DOM을 재사용해 버린다).
 */
export function FadeIn({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [entered, setEntered] = useState(false)

  // 마운트된 프레임에 최종 상태를 칠하면 전환이 생기지 않는다. 한 프레임 뒤에 올린다.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <span className={"transition-opacity duration-200 " + (entered ? "" : "motion-safe:opacity-0") + " " + className}>
      {children}
    </span>
  )
}

/**
 * 버튼 안에 들어가는 스피너. 라벨은 그대로 두고 앞에 붙인다 —
 * 라벨을 "처리 중..."으로 갈아치우면 버튼 폭이 튄다.
 */
export function Spinner() {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block h-3 w-3 shrink-0 rounded-full border-2 border-current border-t-transparent align-[-1px] motion-safe:animate-spin"
    />
  )
}
