// 소유자: A. 계정 설정. 비밀번호 변경과 회원 탈퇴만 둔다.
//
// 왜 이 화면이 필요했는가: 가입 이후 계정을 손댈 수 있는 곳이 하나도 없었다.
// 비밀번호를 바꿀 수도, 계정을 지울 수도 없었다 — 탈퇴 경로가 없는 것은 개인정보를
// 지워 달라는 요청을 받을 방법이 없다는 뜻이라 기능 누락 중 가장 무거운 쪽이다.
//
// 닉네임 변경은 여기 두지 않는다. 결과 화면(/diagnosis/result)에 이미 있고,
// 사이드바의 "이름 바꾸기"가 그리로 보낸다 — 입력 폼을 두 곳에 두면 규칙이 갈린다.
//
// 미인증은 middleware.ts가 /login으로 보낸다. 그래도 첫 줄에서 다시 인증한다 —
// 미들웨어는 쿠키 존재만 보는 UX 게이트이고 보안 경계가 아니다.

import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import SettingsForm from "./SettingsForm"
import "@/styles/tokens.css"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return (
        <main className="hm hm--canvas">
          <div className="hm__col">
            <div className="hm-card">
              <h1 className="hm-ask__question">로그인이 필요해요</h1>
              <p className="hm__note">계정 설정은 로그인한 뒤에 볼 수 있어요.</p>
              <a href="/login?next=/settings" className="hm-btn hm-card__cta">
                로그인하기
              </a>
            </div>
          </div>
        </main>
      )
    }
    console.error("[/settings]", error)
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

  // passwordHash 자체는 클라이언트로 내리지 않는다. "있는지"만 넘긴다
  return (
    <SettingsForm email={user.email} hasPassword={Boolean(user.passwordHash)} nickname={user.nickname} typeCode={user.typeCode} />
  )
}
