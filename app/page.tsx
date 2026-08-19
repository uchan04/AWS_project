"use client"

// 소유자: A. 홈. 종족·펫·오늘 미션 진입점.
//
// 유저·펫·미션 데이터는 DATABASE_URL 공유 후에 붙인다. 지금은 진단 결과만 보여준다.
// 진단 전에는 진단 화면으로 보내는 것 하나만 남긴다. 홈에 아무것도 못 하는 카드를 늘리지 않는다.
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Index-First.
// 홈은 링크 목록이다. 화면을 채우는 가운데 정렬 히어로를 두지 않는다.

import Link from "next/link"
import { useEffect, useState } from "react"
import type { TypeCode } from "@prisma/client"
import { classify } from "@/lib/diagnosis/classify"
import { TRIBE, defaultNickname } from "@/lib/types"
import "@/styles/tokens.css"
import { readDraft } from "./diagnosis/draft"

type Me = { typeCode: TypeCode; nickname: string; greeting: string }

// 시간대 인사. 서버 렌더 시각과 브라우저 시각이 다를 수 있으므로 마운트 후에만 계산한다
function greetingFor(hour: number): string {
  if (hour < 12) return "좋은 아침이에요"
  if (hour < 18) return "오늘 하루도"
  return "오늘도 수고했어요"
}

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    const draft = readDraft()
    if (!draft) return
    try {
      const { typeCode, adjective } = classify(draft)
      setMe({
        typeCode,
        nickname: defaultNickname(typeCode, adjective),
        greeting: greetingFor(new Date().getHours()),
      })
    } catch {
      setMe(null)
    }
  }, [])

  if (!me) {
    return (
      <main className="hm">
        <div className="hm__col hm-home">
          <div className="hm-home__head">
            <h1 className="hm-home__name">함께 걷는 하루</h1>
            <p className="hm__lede">
              몇 가지만 물어볼게요. 답하기 어려운 건 넘어가도 괜찮아요.
            </p>
          </div>

          <Link href="/diagnosis" className="hm-btn">
            시작하기
          </Link>

          <hr className="hm__rule" />
          <p className="hm__note">답한 내용은 이 기기에만 남아요.</p>
        </div>
      </main>
    )
  }

  const tribe = TRIBE[me.typeCode]

  return (
    <main className="hm" data-tribe={me.typeCode}>
      <div className="hm__col hm-home">
        <div className="hm-home__head">
          <p className="hm__note">{me.greeting}</p>
          <h1 className="hm-home__name">{me.nickname}</h1>
          <span className="hm-pill">
            <span aria-hidden="true">{tribe.emoji}</span> {tribe.family}
          </span>
        </div>

        <div className="hm-home__index">
          {/* 펫 이미지는 S3 업로드 전이다. 지금은 이모지 마스코트가 자리를 잡는다 */}
          <Link href="/pet" className="hm-row hm-row--tribe">
            <span className="hm-swatch" aria-hidden="true">
              {tribe.emoji}
            </span>
            <span>
              <span className="hm-row__label">키우기</span>
              <span className="hm-row__hint">{tribe.colorName}</span>
            </span>
            <span className="hm-row__mark" aria-hidden="true">
              →
            </span>
          </Link>

          <Link href="/missions" className="hm-row">
            <span>
              <span className="hm-row__label">오늘의 미션</span>
              <span className="hm-row__hint">작은 것부터 하나만 해봐요</span>
            </span>
            <span className="hm-row__mark" aria-hidden="true">
              →
            </span>
          </Link>

          <Link href="/community" className="hm-row">
            <span>
              <span className="hm-row__label">커뮤니티</span>
              <span className="hm-row__hint">한 줄만 남겨도 충분해요</span>
            </span>
            <span className="hm-row__mark" aria-hidden="true">
              →
            </span>
          </Link>
        </div>

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
