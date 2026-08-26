// 소유자: A. `/` 라우트. **2026-08-26부터 화면이 아니라 갈림길이다.**
//
// 하는 일이 셋뿐이다.
//   미인증        → <Intro authed={false} />   (가입·로그인 유도)
//   진단 미완료    → <Intro authed />           (진단 유도)
//   진단 완료      → redirect("/pet")           ← 홈 화면을 없앴다(아래 리다이렉트 주석)
//
// 미인증도 여기까지 온다 — middleware.ts가 "/"를 공개 경로로 둔다. 그래야 소개 화면이
// 보인다. 실제 인증은 각 API·보호 페이지의 첫 줄이 계속 한다.
//
// 내력: 2026-08-22에 클라이언트 컴포넌트에서 서버로 갈랐고(첫 화면이 "불러오고 있어요…"이던
// 문제), 2026-08-26에 진단 후 분기를 리다이렉트로 바꿨다. HomeDashboard·loadMissions와
// 미션·스킨 조회(왕복 2회, 실측 731ms)를 그때 함께 걷었다.

import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Intro } from "./_components/Intro"
import "@/styles/tokens.css"

// 쿠키를 읽으므로 정적 프리렌더 대상이 아니다
export const dynamic = "force-dynamic"

export default async function HomePage() {
  let user
  try {
    // 스킨은 아래에서 따로 읽는다. 여기서 getCurrentUserWithSkin()을 부르면 스킨 왕복이
    // 미션 조회 앞에 순차로 붙는다 — 실측으로 그게 홈 TTFB의 180ms였다(아래 주석)
    user = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) return <Intro authed={false} />
    // DB 장애다. 미인증 화면을 띄우면 이미 계정이 있는 사람에게 가입을 권하게 된다
    console.error("[/]", error)
    return (
      <main className="hm hm--canvas">
        <div className="hm__col">
          <div className="hm-card">
            <h1 className="hm-ask__question">지금은 불러올 수 없어요</h1>
            <p className="hm__note">잠시 후 다시 들어와 주세요.</p>
          </div>
        </div>
      </main>
    )
  }

  // 진단 전이면 소개 화면. adjective까지 봐야 한다 — typeCode만 있고 형용사가 없는 행은
  // 진단이 중간에 끊긴 상태라 종족 표시가 반쪽이 된다(lib/profile.ts의 diagnosed와 같은 기준)
  // 여기서 먼저 갈라야 진단 전 방문자에게 미션 쿼리가 나가지 않는다
  if (!user.typeCode || !user.adjective) return <Intro authed />
  // **2026-08-26: 홈 화면을 없앴다(사용자 결정). 진단을 마친 사용자는 /pet으로 보낸다.**
  //
  // 왜 없앴나 — 실측하니 홈 카드 3장 중 **고유 정보가 0**이었다:
  //   `오늘의 나`(오늘 N/M · 이번 주 N/M · 연속 N일) = 미션 탭 ProgressCard 3칸과 같은 세 값
  //   `오늘의 미션`                                  = 미션 탭 일일 미션 목록
  //   `키우기`                                        = 사이드바 `나의 펫` 탭에 있는 링크
  //
  // 그리고 이 서비스 고유의 이유가 있다. 첫 화면이 숫자 요약이면 "오늘 2/5"가 성과표로
  // 읽힌다. 펫이면 나를 기다린 존재가 먼저 온다 — OUTING_MOODS 주석의 "격려는 사용자를
  // 격려받아야 하는 위치에 세운다"와 같은 계열이다. 성장형 펫 앱은 펫 화면이 곧 홈이다.
  //
  // **미진단·미인증 분기는 위에 그대로 남는다** — `/`는 여전히 진단 전 사용자의 입구다.
  // 그래서 이 라우트를 지우지 않고 리다이렉트만 둔다.
  //
  // 미션·스킨 조회를 함께 걷었다. 리다이렉트에 필요 없는 왕복 2회였다(실측 731ms).
  redirect("/pet")
}
