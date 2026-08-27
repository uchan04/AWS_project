// 소유자: D (챗봇). 챗봇을 **밖에서 열기 위한 창구** 하나.
//
// 2026-08-26 사용자 요청으로 펫 화면이 챗봇 버튼을 자기 HUD에 갖게 됐다. 그런데
// `ChatLauncher`의 열림 상태는 그 컴포넌트 내부 `useState`이고 외부에서 열 방법이 없었다
// (C가 2026-08-26 개편 기록에 "만들려면 D 소유 파일에 새 인터페이스가 필요하다"고 적었다).
//
// **props로 올리지 않고 이벤트로 둔 이유.** `ChatLauncher`는 `app/layout.tsx`가 마운트하는
// 전역 오버레이이고 펫 화면은 그 아래 어딘가에 있는 페이지다. 열림 상태를 props로 내리려면
// 레이아웃(E 소유)에 상태를 만들고 그것을 페이지까지 내려보내야 하는데, 레이아웃은 서버
// 컴포넌트라 `useState`를 쓸 수 없다 — 그래서 이 래퍼가 상태를 갖고 있는 것이다.
//
// 이 앱에 이미 같은 패턴이 있다: 재화가 바뀌면 `user-stats-changed`를 쏘고 상단 HUD가 듣는다.
// 창구를 문자열 상수로 두는 것은 양쪽이 같은 이름을 쓰게 하려는 것이다 — 손으로 두 번 적으면
// 한쪽만 고쳐질 때 버튼이 조용히 죽는다.
export const CHAT_OPEN_EVENT = "welli:open-chat"

/** 어디서든 챗봇 패널을 연다. 듣는 쪽은 `ChatLauncher` 하나뿐이다 */
export function openChat() {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT))
}
