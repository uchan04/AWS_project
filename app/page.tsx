// 소유자: A. 홈. 로그인·진단 여부만 서버에서 가르고 화면을 고른다.
//
// 2026-08-22 분리: 전에는 홈 전체가 클라이언트 컴포넌트였다. 그래서
//   1) 처음 온 사람이 보는 첫 화면이 "불러오고 있어요…"였다. 소개 화면은
//      /api/diagnosis/me 왕복이 끝난 뒤에야 떴다 — 랜딩으로 쓸 수 없는 순서다
//   2) 서버가 쿠키를 읽어 이미 알고 있는 닉네임·종족을 API로 한 번 더 읽었다
// 지금은 여기서 한 번 읽어 Intro(진단 전) / HomeDashboard(진단 후)로 나눈다.
//
// 미인증도 여기까지 온다 — middleware.ts가 "/"를 공개 경로로 둔다. 그래야 소개 화면이
// 보인다. 실제 인증은 각 API·보호 페이지의 첫 줄이 계속 한다.

import { petImageUrl } from "@/lib/assets"
import { UnauthorizedError, getCurrentUser, getCurrentUserWithSkin } from "@/lib/auth"
import { buildDashboard } from "@/lib/missions/dashboard"
import { ensureMissionReset } from "@/lib/missions/reset"
import { cappedStage } from "@/lib/pet"
import { Intro } from "./_components/Intro"
import HomeDashboard from "./HomeDashboard"
import "@/styles/tokens.css"

// 쿠키를 읽으므로 정적 프리렌더 대상이 아니다
export const dynamic = "force-dynamic"

/**
 * 오늘의 미션·진행률. 실패해도 홈을 죽이지 않는다 — null이면 화면이
 * "불러오지 못했어요"를 띄우고 나머지 카드는 그대로 나온다.
 *
 * buildDashboard를 그대로 쓴다. 홈용 쿼리를 따로 짜면 GET /api/missions와 값이 갈라진다.
 * 필요한 두 조각만 뽑아 넘긴다 — 단계 미션까지 실어 보내면 홈이 쓰지 않는 바이트가 붙는다.
 */
async function loadMissions(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  try {
    const dashboard = await buildDashboard(await ensureMissionReset(user))
    return { dailyMissions: dashboard.dailyMissions, progress: dashboard.progress }
  } catch (error) {
    console.error("[/ missions]", error)
    return null
  }
}

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

  // 오늘의 미션·진행률을 서버에서 읽어 내려보낸다(2026-08-23).
  //
  // 전에는 HomeDashboard가 마운트 후 fetch("/api/missions")로 읽었고, 응답이 도착하는 순간
  // "오늘의 나" 카드가 없던 자리에 끼어들어 아래 내용을 전부 밀어냈다.
  // 실측(prod 빌드, 2026-08-22): CLS 0.2807, shift 1건, 발생 시각 2280ms —
  // fetch가 끝난 그 시점이고 원인 노드는 DIV.hm-home__cards · A.hm-row · H1.hm-home__name이었다.
  // 기준선 0.1의 2.8배다. HTML에 처음부터 들어 있으면 밀어낼 것이 없다.
  //
  // 스킨 읽기와 병렬로 돌린다. 둘 다 user만 있으면 되고 서로를 필요로 하지 않는다.
  // 순차로 두면 왕복이 하나 더 붙는다 — 실측(prod, RDS us-east-1, 왕복 1회 180ms):
  //   순차  912ms / 병렬  731ms
  //
  // 스킨 읽기가 실패해도 홈을 죽이지 않는다. 마스코트 그림 하나이고 이모지 폴백이 있다 —
  // 여기서 throw를 흘리면 홈 전체가 에러 화면이 된다(Promise.all은 하나만 깨져도 거부한다)
  const [skin, missions] = await Promise.all([
    getCurrentUserWithSkin()
      .then((full) => full.activePetSkin)
      .catch(() => null),
    loadMissions(user),
  ])

  // 스킨이 없으면(아직 아무것도 착용하지 않은 계정) null이고, 그때만 이모지로 떨어진다.
  // 기본값 4는 prisma/seed/items.ts의 stageCount와 같다(lib/profile.ts와 같은 이유)
  const petImage = skin ? petImageUrl(skin.imageKeyBase, cappedStage(user.level, skin.stageCount)) : null

  return (
    <HomeDashboard
      nickname={user.nickname || "익명"}
      typeCode={user.typeCode}
      petImage={petImage}
      initialMissions={missions}
    />
  )
}
