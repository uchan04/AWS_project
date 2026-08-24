"use client"

import { useEffect, useRef, type RefObject } from "react"

// 모달 하나가 지켜야 하는 키보드·초점 규칙을 한 곳에 모았다.
//
// 2026-08-22: 이 앱에는 모달이 두 개(미션 상세, 내 계정) 있는데 둘 다
// Escape가 먹지 않고, 열려도 초점이 배경에 남아 있었다. 키보드만 쓰는 사용자는
// 모달이 떠 있는 줄 모르고 뒤 화면을 Tab으로 계속 훑게 된다. 닫을 방법도 없다 —
// × 버튼까지 가려면 배경의 모든 링크를 지나야 한다.
//
// 반환하는 ref를 모달 "내용" div에 붙인다(배경 오버레이가 아니다).
//
// 네이티브 <dialog>.showModal()이면 이 전부가 브라우저 기본 동작으로 온다.
// 그걸 쓰지 않은 이유: 두 모달 다 Figma에서 옮겨온 `position: fixed` 오버레이 +
// 내용 div 구조이고, <dialog>로 바꾸면 배경을 ::backdrop으로 다시 그려야 한다
// (인라인 style로는 ::backdrop을 쓸 수 없다). 화면 두 개를 눈에 보이게 바꾸는
// 위험보다 이 30줄이 싸다.
//
// ponytail: 이 트랩은 모달 안에서 나가는 Tab만 막는다. 배경에 inert를 걸지 않으므로
// 스크린리더 브라우즈 모드로는 뒤 내용에 닿을 수 있다. 거기까지 필요해지면
// <dialog>로 옮기는 것이 답이다.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * @param open 모달을 조건부로 그리는 화면(Sidebar처럼 부모가 항상 마운트돼 있는 경우)에서
 *   false를 주면 아무것도 하지 않는다. 이 값이 없으면 화면이 뜨는 순간부터
 *   배경 스크롤이 잠기고 초점이 엉뚱한 곳으로 간다
 * @param initialFocus 열릴 때 초점을 받을 요소. 기본값은 모달 안의 첫 초점 대상인데,
 *   그게 늘 옳지는 않다 — 챗봇 패널은 안내(ℹ) 버튼이 아니라 입력창에 초점이 가야 한다
 */
export function useModalA11y(
  onClose: () => void,
  open = true,
  initialFocus?: RefObject<HTMLElement | null>
) {
  const ref = useRef<HTMLDivElement>(null)

  // onClose는 호출하는 쪽에서 인라인 화살표로 넘어온다(=매 렌더 새 함수).
  // 그대로 의존성에 넣으면 렌더마다 effect가 다시 돌아 초점을 계속 빼앗는다
  // 렌더 중에 ref를 쓰면 React 컴파일러 규칙(react-hooks/refs)이 막는다. 이펙트에서 갱신한다 —
  // 의존성 배열이 없으므로 렌더마다 최신 함수로 덮인다
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    const opener = document.activeElement as HTMLElement | null

    // 열릴 때 초점을 모달 안으로 옮긴다. 안에 초점 받을 것이 있으면 그 첫 번째,
    // 없으면 컨테이너 자체(tabIndex={-1})
    const el = ref.current
    const firstInside = el?.querySelector<HTMLElement>(FOCUSABLE)
    ;(initialFocus?.current ?? firstInside ?? el)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeRef.current()
        return
      }
      if (e.key !== "Tab") return

      const box = ref.current
      if (!box) return
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        // 안에 초점 받을 것이 없으면 밖으로 나가지 않게만 붙잡는다
        e.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      // 컨테이너에 초점이 있는 상태에서 Shift+Tab을 누르면 배경으로 나간다 — 마지막으로 돌린다
      if (e.shiftKey && (active === first || active === box)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)

    // 모달이 떠 있는 동안 배경이 스크롤되지 않게 한다. 모바일에서 모달 안을 스크롤하려다
    // 뒤 화면이 밀리는 것이 실제로 흔한 불편이다
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prevOverflow
      // 닫으면 열었던 버튼으로 초점을 되돌린다. 안 하면 초점이 <body>로 떨어져
      // 키보드 사용자는 목록 처음부터 다시 Tab해야 한다
      opener?.focus()
    }
    // initialFocus는 ref 객체라 렌더마다 같은 값이다. 넣어도 effect가 다시 돌지 않는다
  }, [open, initialFocus])

  return ref
}
