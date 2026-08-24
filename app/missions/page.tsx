import { unstable_rethrow } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { buildDashboard, type DashboardDTO } from "@/lib/missions/dashboard"
import { ensureMissionReset } from "@/lib/missions/reset"
import MissionDashboard from "./MissionDashboard"

// 유저별 데이터를 읽으므로 정적 프리렌더 대상이 아니다.
export const dynamic = "force-dynamic"

// 2026-08-24 B. 첫 화면 데이터를 서버에서 읽어 props로 내려준다.
//
// 전에는 이 파일이 클라이언트 컴포넌트만 그렸다. 그래서 RSC 응답은 빨랐지만 화면이
// 마운트된 뒤에야 GET /api/missions가 나가고, 그 응답을 기다리는 약 1.2초 동안
// "미션을 불러오는 중..." 한 줄만 떴다. RSC 왕복과 API 왕복이 직렬로 붙는 구조다.
//
// 여기서 읽으면 그 두 왕복이 하나로 합쳐지고, 기다리는 동안은 loading.tsx 뼈대가 뜬다.
// /pet·/community가 이미 같은 방식이다.
//
// GET /api/missions는 그대로 둔다 — 미션 완료 후 재조회(loadDashboard)가 이 라우트를 쓴다.
export default async function MissionsPage() {
  let initial: DashboardDTO | null = null

  try {
    const user = await getCurrentUser()
    // 진단 전이면 미션이 없다. null로 넘기면 화면이 API를 한 번 읽어
    // DIAGNOSIS_NOT_COMPLETED 문구를 그대로 띄운다 — 안내 문장을 두 곳에 두지 않는다.
    if (user.typeCode) {
      // ensureMissionReset이 streakCount를 갱신할 수 있으므로 반환값을 쓴다
      initial = await buildDashboard(await ensureMissionReset(user))
    }
  } catch (error) {
    // cookies()는 정적 렌더 시도 중에 Next 내부 에러를 던진다. 삼키면 Next가 정적 렌더를
    // 포기하지 못한다 (lib/profile.ts의 같은 처리를 따른다).
    unstable_rethrow(error)
    // 미인증·DB 오류는 화면을 죽이지 않는다. null로 내려보내면 클라이언트가 API를 읽고
    // 로그인 안내나 재시도 버튼을 띄운다.
    initial = null
  }

  return <MissionDashboard initial={initial} />
}
