"use client"

// 소유자: A. 진단 결과 화면. docs/dev/diagnosis.md 10장.
//
// 화면에 유형명("건강·정서취약형")과 세부유형을 절대 쓰지 않는다. 종족·동물·색만 보여준다.
// 판정 결과는 GET /api/diagnosis/me에서 읽는다. 화면은 classify()를 부르지 않는다.
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Photographic.
// 종족색은 data-tribe로만 넣는다. style={{ backgroundColor }}를 쓰지 않는다.

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { REDIAGNOSIS_ENABLED } from "@/lib/diagnosis/flags"
import { NICKNAME_MAX, TRIBE, isValidNickname } from "@/lib/types"
import "@/styles/tokens.css"
import { type DiagnosisView, fetchMe, fetchReason, saveNickname } from "../api"

type View = { status: "loading" } | { status: "empty" } | { status: "ok"; me: DiagnosisView }

export default function DiagnosisResultPage() {
  const router = useRouter()
  const [view, setView] = useState<View>({ status: "loading" })
  const [nickname, setNickname] = useState("")
  // blur 전에는 오류를 띄우지 않는다. 지우는 중에 빨간 글씨가 따라오면 압박이 된다
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // 판정 근거 3줄. undefined = 아직 읽는 중, null = 못 만들었다(카드를 뺀다)
  const [reason, setReason] = useState<string[] | null | undefined>(undefined)
  // 방금 진단을 마치고 온 것인지. AskFlow가 ?new=1을 붙여 보낸다.
  // 이 화면은 이름을 바꾸러 다시 들어오는 경로이기도 해서(하단 탭·사이드바) 문구를 갈라야 한다.
  const [justDiagnosed, setJustDiagnosed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchMe()
      .then((me) => {
        if (!alive) return
        // 쿼리는 마운트 후에 읽는다. 렌더 중에 읽으면 서버·클라이언트 문구가 달라 하이드레이션이 깨진다
        setJustDiagnosed(new URLSearchParams(window.location.search).has("new"))
        if (!me) {
          setView({ status: "empty" })
          return
        }
        setView({ status: "ok", me })
        setNickname(me.nickname)
      })
      .catch(() => {
        if (alive) setView({ status: "empty" })
      })

    // 근거는 Bedrock 왕복이라 결과 화면보다 늦게 온다. 화면을 붙잡아 두지 않는다
    fetchReason()
      .then((lines) => {
        if (alive) setReason(lines)
      })
      .catch(() => {
        if (alive) setReason(null)
      })

    return () => {
      alive = false
    }
  }, [])

  async function start(current: DiagnosisView) {
    // 이름을 바꾸지 않았으면 서버를 부르지 않는다
    if (nickname === current.nickname) {
      router.push("/")
      // 진단으로 typeCode가 생겼다. 서버 레이아웃을 다시 렌더해야 사이드바에
      // 종족 색·이모지와 챗봇 버튼이 반영된다
      router.refresh()
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await saveNickname(nickname)
      router.push("/")
      router.refresh()
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "잠시 후 다시 시도해 주세요")
    } finally {
      setSaving(false)
    }
  }

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

  // 이모지·색이름은 표시용 상수에서만 가져온다. API는 종족 표시명만 준다
  const tribe = TRIBE[view.me.typeCode]
  const valid = isValidNickname(nickname)
  const showError = touched && !valid

  return (
    <main className="hm hm--canvas" data-tribe={view.me.typeCode}>
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
            {/* 판정 근거 3줄(SPEC 3절). 사용자가 고른 답을 되돌려 읽어주는 문장이며,
                유형을 설명하지 않는다. 만들지 못했으면 이 카드만 빠진다 */}
            {reason === undefined ? (
              <p className="hm__note">방금 한 이야기를 정리하고 있어요…</p>
            ) : reason ? (
              <div className="hm-card hm-card--tribe">
                <p className="hm__note">이렇게 들었어요</p>
                <ul className="hm-check">
                  {reason.map((line) => (
                    <li key={line}>
                      <span className="hm-check__mark" aria-hidden="true">
                        ·
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

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

            {/* 이름을 고쳤을 때만 PATCH하고 홈으로 넘어간다 */}
            <button
              type="button"
              onClick={() => void start(view.me)}
              disabled={!valid || saving}
              className="hm-btn"
            >
              {/* 닉네임을 문장에 넣지 않는다. 조사(으로/로)가 받침에 따라 갈려서 어색해진다 */}
              {saving ? "저장하고 있어요…" : justDiagnosed ? "이 이름으로 시작하기" : "이름 저장하기"}
            </button>
            {saveError && <p className="hm-field__help hm-field__help--error">{saveError}</p>}

            {/* 재진단은 잠겨 있다(lib/diagnosis/flags.ts) */}
            {REDIAGNOSIS_ENABLED && (
              <Link href="/diagnosis" className="hm-link">
                다시 진단하기
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
