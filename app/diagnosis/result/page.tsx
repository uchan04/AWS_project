"use client"

// 소유자: A. 진단 결과 화면. docs/dev/diagnosis.md 10장.
//
// 화면에 유형명("건강·정서취약형")과 세부유형을 절대 쓰지 않는다. 종족·동물·색만 보여준다.
// 판정을 여기서 하는 것은 완료 API가 붙기 전까지의 임시 조치다(app/diagnosis/draft.ts).
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Photographic.
// 종족색은 data-tribe로만 넣는다. style={{ backgroundColor }}를 쓰지 않는다.

import Link from "next/link"
import { useEffect, useState } from "react"
import type { Adjective, TypeCode } from "@prisma/client"
import { classify } from "@/lib/diagnosis/classify"
import { NICKNAME_MAX, TRIBE, defaultNickname, isValidNickname } from "@/lib/types"
import "@/styles/tokens.css"
import { readDraft } from "../draft"

type View =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ok"; typeCode: TypeCode; adjective: Adjective }

export default function DiagnosisResultPage() {
  const [view, setView] = useState<View>({ status: "loading" })
  const [nickname, setNickname] = useState("")
  // blur 전에는 오류를 띄우지 않는다. 지우는 중에 빨간 글씨가 따라오면 압박이 된다
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    const draft = readDraft()
    if (!draft) {
      setView({ status: "empty" })
      return
    }
    try {
      const { typeCode, adjective } = classify(draft)
      setView({ status: "ok", typeCode, adjective })
      setNickname(defaultNickname(typeCode, adjective))
    } catch {
      // 답변이 깨졌으면 다시 진단하는 것이 유일한 복구 경로다
      setView({ status: "empty" })
    }
  }, [])

  if (view.status === "loading") {
    return (
      <main className="hm hm--canvas">
        <div className="hm__col">
          <p className="hm__note">결과를 준비하고 있어요…</p>
        </div>
      </main>
    )
  }

  if (view.status === "empty") {
    return (
      <main className="hm hm--canvas">
        <div className="hm__col hm-result">
          <div className="hm-result__head">
            <h1 className="hm-result__title">아직 진단 결과가 없어요</h1>
            <p className="hm__note">몇 가지만 물어볼게요. 답하기 어려운 건 넘어가도 괜찮아요.</p>
          </div>
          <Link href="/diagnosis" className="hm-btn">
            진단 시작하기
          </Link>
        </div>
      </main>
    )
  }

  const tribe = TRIBE[view.typeCode]
  const valid = isValidNickname(nickname)
  const showError = touched && !valid

  return (
    <main className="hm hm--canvas" data-tribe={view.typeCode}>
      <div className="hm__col hm-result">
        {/* 왼쪽 종족판 · 오른쪽 안내와 이름. Figma 결과 화면 구성이다 */}
        <div className="hm-result__grid">
          {/* 펫 이미지는 S3 업로드 전이다. 이모지 마스코트가 그 자리를 잡고 있다 */}
          <div className="hm-plate hm-plate--hero">
            <span className="hm-plate__disc hm-bounce" aria-hidden="true">
              {tribe.emoji}
            </span>
            <span className="hm-plate__eyebrow">당신은</span>
            <span className="hm-plate__animal">
              {tribe.family} · {tribe.animal}
            </span>
            <span className="hm-plate__caption">{tribe.colorName}</span>
          </div>

          <div className="hm-result__side">
            {/* 종족의 성격을 설명하지 않는다. 유형 설명은 낙인이 된다(SPEC 2절).
                서비스가 무엇을 하는지만 적는다 */}
            <div className="hm-card">
              <p className="hm__note">이렇게 함께해요</p>
              <ul className="hm-check">
                {["매일 작은 미션으로 나를 돌봐요", "펫을 함께 키우며 성장해요", "같은 종족과 익명으로 이야기해요"].map(
                  (line) => (
                    <li key={line}>
                      <span className="hm-check__mark" aria-hidden="true">
                        ✓
                      </span>
                      <span>{line}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="hm-field">
              <label className="hm-field__label" htmlFor="nickname">
                이름
              </label>
              <div className="hm-field__box">
                <input
                  id="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  onBlur={() => setTouched(true)}
                  maxLength={NICKNAME_MAX}
                  aria-invalid={showError}
                  aria-describedby="nickname-help"
                  className="hm-field__input"
                />
                {showError && (
                  <span className="hm-field__glyph" aria-hidden="true">
                    !
                  </span>
                )}
              </div>
              {/* 도움말과 오류가 같은 자리를 쓴다. 자리를 비워둬서 오류가 떠도 화면이 밀리지 않는다 */}
              <p
                id="nickname-help"
                className={`hm-field__help${showError ? " hm-field__help--error" : ""}`}
              >
                {showError
                  ? "닉네임은 2~12자로 입력해 주세요"
                  : "지금 바꿔도 되고, 나중에 바꿔도 돼요"}
              </p>
            </div>

            {/* 닉네임 PATCH·유저 저장은 DATABASE_URL 공유 후에 붙인다 */}
            <Link href="/" aria-disabled={!valid} className="hm-btn">
              {/* 닉네임을 문장에 넣지 않는다. 조사(으로/로)가 받침에 따라 갈려서 어색해진다 */}
              이 이름으로 시작하기
            </Link>

            <Link href="/diagnosis" className="hm-link">
              다시 진단하기
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
