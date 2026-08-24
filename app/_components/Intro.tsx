import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"

// 소유자: A. 진단 전 홈 = 시작 화면. Figma 인트로 구성(왼쪽 글, 오른쪽 안내 카드).
//
// 서버 컴포넌트다(2026-08-22 분리). 전에는 홈 전체가 클라이언트 컴포넌트여서
// 이 화면도 /api/diagnosis/me 왕복이 끝난 뒤에야 떴다 — 처음 온 사람이 보는 첫 화면이
// "불러오고 있어요…"였다. 이 화면에는 사용자 데이터가 없으므로 서버에서 바로 그린다.
//
// 유형명은 쓰지 않는다(SPEC 2절). 종족(동물)까지만 보여준다.
const TRIBE_LIST = (Object.keys(TRIBE) as TypeCode[]).map((code) => ({ code, ...TRIBE[code] }))

/**
 * @param authed 로그인은 했지만 진단만 안 한 사람도 이 화면을 본다.
 *   그 사람을 /signup으로 보내면 이미 있는 계정을 다시 만들려 한다
 */
export function Intro({ authed }: { authed: boolean }) {
  return (
    <main className="hm hm--canvas">
      <div className="hm__col hm-intro">
        <div className="hm-intro__side">
          <div>
            {/* 서비스명을 첫 화면에 박는다(2026-08-24 사용자 확정: 모꼬지).
                전에는 "함께 걷는 하루"라는 표어였는데, 랜딩에서 이름을 못 읽으면
                방문자가 무엇을 쓰는지 모른 채 시작하기를 누른다 */}
            <p className="hm__note">모꼬지</p>
            <h1 className="hm-home__name">나는 어떤 존재일까요?</h1>
          </div>
          <p className="hm__lede">
            몇 가지만 물어볼게요. 답하기 어려운 건 넘어가도 괜찮아요.
            어떤 결과도 옳고 그름이 없어요.
          </p>

          <div className="hm-trio">
            {TRIBE_LIST.map(({ code, animal, emoji }) => (
              <div key={code} className="hm-tile hm-tile--tribe" data-tribe={code}>
                <span className="hm-tile__face" aria-hidden="true">
                  {emoji}
                </span>
                <span className="hm-tile__title">{animal}</span>
              </div>
            ))}
          </div>

          {/* 미인증이면 가입부터. 로그인 상태로 여기 온 사람은 진단만 안 한 것이므로 문항으로 보낸다 */}
          <Link href={authed ? "/diagnosis" : "/signup"} className="hm-btn">
            시작하기
          </Link>
          {!authed && (
            <Link href="/login" className="hm-link">
              이미 계정이 있어요
            </Link>
          )}
        </div>

        <div className="hm-card">
          <span className="hm-intro__mascot hm-float" aria-hidden="true">
            🌿
          </span>
          <ul className="hm-check">
            {["낙인을 만들지 않아요", "경쟁이 없어요", "진단 결과는 나만 알아요"].map((line) => (
              <li key={line}>
                <span className="hm-check__mark" aria-hidden="true">
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <hr className="hm__rule" />
          <p className="hm__note">약 3분 걸려요. 언제든 다시 할 수 있어요.</p>
          {/* 결과가 서버에 저장되므로 "이 기기에만 남는다"고 쓸 수 없다 */}
          <p className="hm__note">결과는 내 계정에만 저장돼요.</p>
        </div>
      </div>
    </main>
  )
}
