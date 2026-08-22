import { redirect } from "next/navigation"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { buildDashboard } from "@/lib/missions/dashboard"
import type { DashboardDTO } from "@/lib/missions/dashboard"
import { ensureMissionReset } from "@/lib/missions/reset"
import MissionDashboard from "./MissionDashboard"

// 소유자: B. 미션 화면.
//
// 서버에서 대시보드를 조립해 내려보낸다(2026-08-23). 전에는 이 파일이
// `return <MissionDashboard />` 한 줄이었고, 데이터는 클라이언트가 마운트된 뒤
// useEffect의 fetch("/api/missions")로 가져왔다. 그러면 순서가 이렇게 된다:
//
//   HTML 도착(TTFB) → JS 다운로드·실행 → fetch 시작 → 응답 → 첫 미션 렌더
//
// 실측(prod 빌드, 2026-08-22):
//   /missions   TTFB 539ms → /api/missions 3589ms → LCP 4324ms
//   /community  (서버 렌더) TTFB 901ms → LCP 1332ms
// 같은 코드베이스에서 렌더 방식 차이만으로 3배가 났다. HTML 안에 미션이 들어 있으면
// fetch 왕복이 임계 경로에서 빠진다.
//
// 조립 순서는 GET /api/missions와 같다(getCurrentUser → ensureMissionReset → buildDashboard).
// 그 라우트는 지운 게 아니라 그대로 둔다 — 미션을 완료한 뒤 목록을 다시 읽는 데 계속 쓴다.
// 로직을 여기 복사하지 않고 같은 함수 둘을 부르므로 두 경로가 갈라지지 않는다.
//
// 인증을 읽으므로 정적 프리렌더 대상이 아니다(app/pet/page.tsx와 같은 이유).
export const dynamic = "force-dynamic"

export default async function MissionsPage() {
  let initial: DashboardDTO | null = null
  let initialError: string | null = null

  try {
    const user = await getCurrentUser()

    // 진단 전에는 미션이 없다. 라우트가 400으로 돌려주던 것과 같은 문장을 그대로 넘겨
    // 클라이언트의 기존 에러 화면이 뜨게 한다 — 화면을 새로 만들지 않는다
    if (!user.typeCode) {
      initialError = "진단을 먼저 완료해주세요"
    } else {
      // ensureMissionReset이 streakCount를 갱신할 수 있으므로 반환값을 쓴다
      initial = await buildDashboard(await ensureMissionReset(user))
    }
  } catch (error) {
    // 미인증이면 안내가 아니라 로그인이다. 미들웨어는 쿠키 존재만 보므로
    // 만료·위조 쿠키를 든 사람이 여기까지 온다(app/pet/page.tsx와 같은 처리)
    if (error instanceof UnauthorizedError) redirect("/login?next=%2Fmissions")
    console.error("[/missions]", error)
    // DB 장애는 화면을 죽이지 않는다. 클라이언트의 "다시 시도" 버튼이 fetch로 재시도한다
    initialError = "미션을 불러올 수 없습니다"
  }

  return <MissionDashboard initial={initial} initialError={initialError} />
}
