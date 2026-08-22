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
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage } from "@/lib/pet"
import { Intro } from "./_components/Intro"
import HomeDashboard from "./HomeDashboard"
import "@/styles/tokens.css"

// 쿠키를 읽으므로 정적 프리렌더 대상이 아니다
export const dynamic = "force-dynamic"

export default async function HomePage() {
  let user
  try {
    // 활성 스킨까지 읽는다 — 홈 마스코트를 실제 펫 그림으로 띄우기 위한 것이다.
    // 레이아웃이 같은 요청에서 이미 이 함수를 부르므로 쿼리는 늘지 않는다(lib/auth.ts의 cache)
    user = await getCurrentUserWithSkin()
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
  if (!user.typeCode || !user.adjective) return <Intro authed />

  // 스킨이 없으면(아직 아무것도 착용하지 않은 계정) null이고, 그때만 이모지로 떨어진다.
  // 기본값 4는 prisma/seed/items.ts의 stageCount와 같다(lib/profile.ts와 같은 이유)
  const skin = user.activePetSkin
  const petImage = skin ? petImageUrl(skin.imageKeyBase, cappedStage(user.level, skin.stageCount)) : null

  return (
    <HomeDashboard nickname={user.nickname || "익명"} typeCode={user.typeCode} petImage={petImage} />
  )
}
