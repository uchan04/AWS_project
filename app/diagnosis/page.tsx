import Link from "next/link"
import { redirect } from "next/navigation"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { REDIAGNOSIS_ENABLED } from "@/lib/diagnosis/flags"
import AskFlow from "./_components/AskFlow"
import "@/styles/tokens.css"

// 소유자: A. 진단 화면의 로그인 게이트. 문항 흐름은 _components/AskFlow.tsx에 있다.
//
// 문항을 그리기 전에 막는 이유: POST /api/diagnosis/complete가 인증을 요구하므로
// 미인증 상태로 시작하면 문항 10개를 다 답한 뒤에야 401이 뜬다. 답변은 화면에만 있고
// 서버에 없어서 로그인하고 돌아오면 처음부터 다시 풀어야 한다. (D 제보, 2026-08-20)
//
// 서버에서 확인한다. 클라이언트에서 하지 않는 이유 두 가지:
//   1. 이 화면은 정적 프리렌더 대상이었다. 마운트 후에 확인하면 문항이 한 번 그려진 뒤
//      안내 카드로 바뀌어 깜빡인다
//   2. 확인 요청 자체가 실패할 수 있다. 그때 통과시키면 원래 문제가 그대로 나고,
//      막으면 로그인한 사람이 네트워크 한 번 끊겼다고 진단을 시작할 수 없다.
//      서버 컴포넌트는 요청이 하나뿐이라 이 선택지가 아예 생기지 않는다
//
// 미인증과 DB 장애를 갈라야 한다(2026-08-22 수정).
// 미들웨어가 미인증 방문자를 이미 /login?next=/diagnosis로 보내므로, 여기 catch에
// 걸리는 것은 위조·만료 쿠키이거나 DB 장애다. 전자에 필요한 것은 재로그인이고,
// 후자에 "먼저 가입해 주세요"를 띄우면 이미 계정이 있는 사람이 가입을 시도하게 된다.
// (app/pet/page.tsx·app/community/page.tsx와 같은 패턴)

// 유저 인증을 읽으므로 정적 프리렌더 대상이 아니다.
// 이걸 빼면 빌드 시점의 미인증 안내 화면이 정적으로 굳는다.
export const dynamic = "force-dynamic"

export default async function DiagnosisPage() {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login?next=%2Fdiagnosis")
    console.error("[/diagnosis]", error)
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-ask">
          <div className="hm-card">
            <h1 className="hm-ask__question">지금은 진단을 시작할 수 없어요</h1>
            <p className="hm__note">
              잠시 후 다시 들어와 주세요. 답한 내용이 저장되지 않을 수 있어서 시작을 미뤘어요.
            </p>
            <Link href="/" className="hm-btn hm-card__cta">
              홈으로
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // 재진단이 잠겨 있으면 이미 진단한 사람은 문항을 다시 풀지 않는다.
  // 문항을 다 풀고 나서 완료 API가 400을 내는 것보다 여기서 돌려보내는 쪽이 낫다.
  if (!REDIAGNOSIS_ENABLED && user.typeCode) redirect("/diagnosis/result")

  return <AskFlow />
}
