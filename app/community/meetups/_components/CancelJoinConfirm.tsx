"use client"

/**
 * 신청 취소 확인. **모임 화면에서 취소를 묻는 자리는 전부 이것 하나를 쓴다** —
 * 카드(MeetupCard)와 나의 신청 현황(MyJoinsModal) 두 곳이다.
 *
 * 각자 두지 않고 뺀 이유는 하나다. 문구와 버튼 배치가 완전히 같은데 두 벌로 두면
 * 한쪽만 고쳐져 조용히 갈라진다(이 폴더의 색·상수 주석들이 반복해서 경고하는 그 사고다).
 * `transitions.tsx`가 FadeIn·Spinner를 모아 둔 것과 같은 자리다.
 *
 * ── 지켜야 할 두 가지 ─────────────────────────────────────────────────────────
 *
 * **왼쪽이 되돌리는 쪽, 오른쪽이 실행이다.** 서비스 전체가 같은 순서를 쓴다.
 * 뒤집으면 습관으로 누르던 사람이 취소할 생각이 없었는데 취소하게 된다.
 *
 * **사유를 묻지 않는다(2026-08-27).** 예전 카드에는 사유 칩과 한 줄 입력이 있었는데,
 * 취소하려는 사람에게 이유를 물으면 취소를 회피하고 말없이 안 나타나는 쪽으로 흐른다.
 * API는 body 없는 DELETE를 정상으로 받는다(join/route.ts의 DELETE).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// 인라인 펼침. window.confirm을 쓰지 않는다 — 높이·투명도를 함께 전환하려고 항상 렌더해 두고
// max-h로 접는다. 접혀 있는 동안에는 버튼을 disabled로 둬서 탭 이동에도 잡히지 않는다.
// 값은 MeetupCard의 다른 펼침 영역과 같다.
const EXPAND_BASE = "overflow-hidden motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
const EXPAND_CLOSED = "max-h-0 opacity-0"

// 버튼 규격은 MeetupCard와 같은 값이다. 같은 화면에서 두 벌이 되지 않게 맞춰 둔다.
const BUTTON_BASE =
  "inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-40"
const QUIET_BUTTON = BUTTON_BASE + " border border-rule bg-card text-ink-2 hover:bg-paper"

export function CancelJoinConfirm({
  open,
  pending,
  onKeep,
  onConfirm,
  // 패널 배경. 카드는 회색 바탕 위가 아니라 흰 카드 안이라 bg-paper을,
  // 모달의 회색 항목 안에서는 bg-card를 쓴다. 그 외에는 같다.
  panelClassName = "flex flex-col gap-2 rounded-xl border border-rule bg-paper p-3",
}: {
  open: boolean
  pending: boolean
  onKeep: () => void
  onConfirm: () => void
  panelClassName?: string
}) {
  return (
    <div aria-hidden={!open} className={EXPAND_BASE + " " + (open ? "max-h-64 opacity-100" : EXPAND_CLOSED)}>
      <div className={panelClassName}>
        {/* 취소를 나무라지 않는다. 결정을 되묻거나 이유를 캐지 않는다 */}
        <p className="text-xs leading-relaxed text-ink-2">
          이 모임 신청을 취소할게요. 마음이 바뀌면 자리가 남아 있는 동안 다시 신청할 수 있어요.
        </p>
        <div className="flex gap-2">
          {/* 왼쪽은 되돌리는 쪽, 오른쪽이 실제 취소다 */}
          <button type="button" onClick={onKeep} disabled={!open || pending} className={QUIET_BUTTON}>
            그대로 둘게요
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!open || pending}
            className={BUTTON_BASE + " bg-red-500 text-accent-ink hover:bg-red-600"}
          >
            {pending ? "취소하는 중…" : "신청 취소하기"}
          </button>
        </div>
      </div>
    </div>
  )
}
