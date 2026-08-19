"use client"

// 소유자: A. 홈. 종족·펫·오늘 미션 진입점.
//
// 진단 결과는 GET /api/diagnosis/me에서 읽는다. 펫·미션 실데이터는 B·C의 API가 나온 뒤에 붙인다.
// 진단 전에는 진단 화면으로 보내는 것 하나만 남긴다. 홈에 아무것도 못 하는 카드를 늘리지 않는다.
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Index-First.
// 홈은 링크 목록이다. 화면을 채우는 가운데 정렬 히어로를 두지 않는다.

import Link from "next/link"
import { useEffect, useState } from "react"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
// 미션 문구는 A가 가진 시드 콘텐츠가 정본이다. 홈에 복사해 두지 않고 그 배열을 읽는다
import { DAILY } from "@/prisma/seed/missions"
import "@/styles/tokens.css"
import { type DiagnosisView, fetchMe } from "./diagnosis/api"

// 진단 전 화면에서 세 종족을 나란히 보여줄 때 쓴다
const TRIBE_LIST = (Object.keys(TRIBE) as TypeCode[]).map((code) => ({ code, ...TRIBE[code] }))

// 시간대 인사. 서버 렌더 시각과 브라우저 시각이 다를 수 있으므로 마운트 후에만 계산한다
function greetingFor(hour: number): string {
  if (hour < 12) return "좋은 아침이에요"
  if (hour < 18) return "오늘 하루도"
  return "오늘도 수고했어요"
}

export default function HomePage() {
  // undefined = 아직 읽는 중. null과 구분해야 진단한 사람에게 시작 화면이 깜박이지 않는다
  const [me, setMe] = useState<DiagnosisView | null | undefined>(undefined)
  const [greeting, setGreeting] = useState("")

  useEffect(() => {
    let alive = true
    setGreeting(greetingFor(new Date().getHours()))
    fetchMe()
      .then((next) => {
        if (alive) setMe(next)
      })
      .catch(() => {
        if (alive) setMe(null)
      })
    return () => {
      alive = false
    }
  }, [])

  if (me === undefined) {
    return (
      <main className="hm hm--canvas">
        <div className="hm__col">
          <p className="hm__note">불러오고 있어요…</p>
        </div>
      </main>
    )
  }

  // 진단 전 홈 = 시작 화면. Figma 인트로 구성(왼쪽 글, 오른쪽 안내 카드)을 가져왔다
  if (!me) {
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-intro">
          <div className="hm-intro__side">
            <div>
              <p className="hm__note">함께 걷는 하루</p>
              <h1 className="hm-home__name">나는 어떤 존재일까요?</h1>
            </div>
            <p className="hm__lede">
              몇 가지만 물어볼게요. 답하기 어려운 건 넘어가도 괜찮아요.
              어떤 결과도 옳고 그름이 없어요.
            </p>

            {/* 세 종족을 미리 보여준다. 유형명은 쓰지 않는다(SPEC 2절) */}
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

            <Link href="/diagnosis" className="hm-btn">
              시작하기
            </Link>
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

  const tribe = TRIBE[me.typeCode]

  return (
    <main className="hm" data-tribe={me.typeCode}>
      <div className="hm__col hm-home">
        {/* 인사말·이름은 왼쪽, 마스코트는 오른쪽. Figma 홈 헤더 구성이다 */}
        <div className="hm-home__head">
          <div className="hm-home__who">
            <p className="hm__note">{greeting}</p>
            <h1 className="hm-home__name">{me.nickname}</h1>
            <span className="hm-pill">
              <span aria-hidden="true">{tribe.emoji}</span> {tribe.family}
            </span>
          </div>
          {/* 펫 이미지는 S3 업로드 전이다. 지금은 이모지 마스코트가 자리를 잡는다 */}
          <span className="hm-home__mascot hm-float" aria-hidden="true">
            {tribe.emoji}
          </span>
        </div>

        <div className="hm-home__cards">
          {/* 펫 카드. 레벨·경험치는 DATABASE_URL 공유 후에 넣는다. 없는 숫자를 지어내지 않는다 */}
          <div className="hm-card hm-card--tribe">
            <div className="hm-card__head">
              <h2 className="hm-card__title">키우기</h2>
              <span className="hm__note">{tribe.colorName}</span>
            </div>
            <p className="hm__note">씨앗을 모아 함께 자라요.</p>
            <Link href="/pet" className="hm-btn hm-card__cta">
              펫 보러 가기
            </Link>
          </div>

          {/* 오늘의 미션 미리보기. 문구는 시드 콘텐츠(DAILY)에서 읽는다.
              완료 여부는 DB가 붙은 뒤에 표시한다 */}
          <div className="hm-card">
            <div className="hm-card__head">
              <h2 className="hm-card__title">오늘의 미션</h2>
              <Link href="/missions" className="hm-link">
                전체 보기
              </Link>
            </div>
            <div className="hm-tiles">
              {DAILY.slice(0, 4).map((mission) => (
                <div key={mission.code} className="hm-tile">
                  <span className="hm-tile__title">{mission.title}</span>
                  <span className="hm-tile__hint">씨앗 {mission.rewardSeeds}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link href="/community" className="hm-row">
          <span>
            <span className="hm-row__label">커뮤니티</span>
            <span className="hm-row__hint">한 줄만 남겨도 충분해요</span>
          </span>
          <span className="hm-row__mark" aria-hidden="true">
            →
          </span>
        </Link>

        <div className="hm-home__foot">
          <hr className="hm__rule" />
          <Link href="/diagnosis" className="hm-link">
            다시 진단하기
          </Link>
        </div>
      </div>
    </main>
  )
}
