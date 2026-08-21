"use client"

import { useState } from "react"
import type { TypeCode } from "@prisma/client"
import { animalEmoji } from "@/lib/pet"
import { TRIBE } from "@/lib/types"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 스킨 목록 + 구매·전환. (SPEC.md 5절)
//
// 스킨은 자기 종족 전용 외형이다(2026-08-20 결정). 여기 들어오는 목록은 이미
// user.typeCode로 걸러져 있으므로 전부 같은 동물이다. 능력치 효과는 없어졌다 —
// 바뀌는 것은 외형뿐이고 진화 3단은 기본 외형과 같다.
//
// design.md: 타일 버튼이 여러 개이므로 전부 ghost다. 종족색은 CTA에 쓰지 않는다.
// 이모지는 마스코트 자리(원판·배지)에만 쓴다 — 스킨 타일의 얼굴이 그 자리다.

export type SkinRow = {
  id: string
  name: string
  typeCode: TypeCode
  isDefault: boolean
  stageCount: number
  priceShards: number | null
  owned: boolean
  active: boolean
}

export type SkinListProps = {
  skins: SkinRow[]
  starShards: number
}

export default function SkinList({ skins: initial, starShards: initialShards }: SkinListProps) {
  const [skins, setSkins] = useState(initial)
  const [starShards, setStarShards] = useState(initialShards)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function call(skin: SkinRow, path: "buy" | "activate") {
    if (pending) return
    setPending(skin.id)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch(`/api/pet/skins/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId: skin.id }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? "잠시 후 다시 시도해 주세요")
        return
      }

      if (path === "buy") {
        setStarShards(json.data.starShards)
        setSkins((prev) =>
          prev.map((row) => (row.id === skin.id ? { ...row, owned: true } : row)),
        )
        setNotice(`${skin.name}를 데려왔어요. 전환해서 바로 쓸 수 있어요.`)
        window.dispatchEvent(new CustomEvent("user-stats-changed"))
      } else {
        setSkins((prev) => prev.map((row) => ({ ...row, active: row.id === skin.id })))
        setNotice(`이제 ${skin.name}와 함께해요.`)
        window.dispatchEvent(new CustomEvent("user-stats-changed"))
      }
    } catch {
      setError("네트워크 연결을 확인해 주세요")
    } finally {
      setPending(null)
    }
  }

  const groups = [
    { title: "기본 외형", hint: "진단으로 받았어요", rows: skins.filter((row) => row.isDefault) },
    {
      title: "상점",
      hint: "외형만 바뀌어요",
      rows: skins.filter((row) => !row.isDefault),
    },
  ]

  return (
    <main className="hm hm--canvas">
      <div className="hm__col hm-pet">
        <div className="hm-status">
          <h1 className="hm-card__title">스킨</h1>
          <span className="hm__note">별조각 {starShards}</span>
        </div>

        <p className="hm__note">
          레벨과 경험치는 외형이 아니라 나에게 붙어 있어요. 바꿔도 그대로예요.
        </p>

        {error ? (
          <p className="hm-field__help hm-field__help--error" role="alert">
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="hm-field__help" role="status">
            {notice}
          </p>
        ) : null}

        {groups.map((group) =>
          group.rows.length === 0 ? null : (
            <div className="hm-card" key={group.title}>
              <div className="hm-card__head">
                <h2 className="hm-card__title">{group.title}</h2>
                <span className="hm__note">{group.hint}</span>
              </div>

              <div className="hm-tiles">
                {group.rows.map((skin) => {
                  const tribe = TRIBE[skin.typeCode]
                  const price = skin.priceShards
                  const tooPoor = price !== null && starShards < price

                  return (
                    <div className="hm-tile hm-pet__cos" key={skin.id}>
                      <span className="hm-tile__face" aria-hidden="true">
                        {animalEmoji(skin.name)}
                      </span>
                      <span className="hm-tile__title">{skin.name}</span>
                      <span className="hm-tile__hint">{tribe.family}</span>

                      {skin.active ? (
                        <span className="hm-pill">함께하는 중</span>
                      ) : skin.owned ? (
                        <button
                          type="button"
                          onClick={() => call(skin, "activate")}
                          disabled={pending !== null}
                          aria-disabled={pending !== null}
                          className="hm-btn hm-btn--ghost"
                        >
                          전환
                        </button>
                      ) : price === null ? (
                        // 기본 외형은 진단이 지급한다. 상점에 없다
                        <span className="hm-tile__hint">진단으로 받아요</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => call(skin, "buy")}
                          disabled={pending !== null || tooPoor}
                          aria-disabled={pending !== null || tooPoor}
                          className="hm-btn hm-btn--ghost"
                        >
                          별조각 {price}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ),
        )}
      </div>
    </main>
  )
}
