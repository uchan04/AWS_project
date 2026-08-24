import { redirect } from "next/navigation"
import { getSidebarProfile } from "@/lib/profile"
import RestRoom from "./_components/RestRoom"

// 소유자: C. "아무것도 안 하는" 화면. (원안은 antigravity가 develop에 올린 /pet/rest)
//
// develop 판에서 바꾼 것:
// - **미션과 완전히 끊었다.** 원안은 `DAILY_REST` 미션 행을 findUnique로 찾아 없으면
//   redirect("/")하고, 3분이 지나면 자동으로 완료 API를 쳤다. 그러면 (1) 공유 DB에
//   시드를 넣어야 화면이 열리고, (2) 일일 미션 총개수가 5→6이 되어 별조각 60 보너스와
//   연속 달성 막대가 조용히 움직이고(lib/missions/completion.ts dailyTotal),
//   (3) 시드가 없는 환경에서는 같은 코드가 다르게 동작한다.
//   쉬는 화면에 보상을 붙이면 "쉬는 것"이 또 하나의 과제가 된다 — 그게 이 화면의 반대다.
// - 종족색·동물명을 여기서 다시 정의하지 않는다. 원안은 CHARACTER_COLOR/BG/EMOJI 맵 3개를
//   새로 선언하고 `typeCode.includes("HEALTH_EMOTION")`으로 골랐다. 정본은 lib/types.ts의
//   TRIBE 하나다(유형이 늘면 includes 분기는 조용히 마지막 값으로 떨어진다).
// - 프로필도 다시 쿼리하지 않고 lib/profile.ts의 getSidebarProfile()을 쓴다.
export const dynamic = "force-dynamic"

export default async function PetRestPage() {
  const profile = await getSidebarProfile()
  // 미들웨어가 이미 막지만 DEV_AUTH_BYPASS·쿠키 위조 경로가 있어 여기서도 확인한다
  if (!profile) redirect("/login?next=/pet/rest")

  return <RestRoom typeCode={profile.typeCode} imageUrl={profile.imageUrl} />
}
