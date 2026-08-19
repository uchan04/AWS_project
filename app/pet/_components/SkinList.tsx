"use client"

import { useState } from "react"
import type { EffectType, TypeCode } from "@prisma/client"
import { animalEmoji } from "@/lib/pet"
import { TRIBE } from "@/lib/types"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 캐릭터 목록 + 구매·전환. (SPEC.md 5절)
//
// 구매 제한 없음 — 유형과 무관하게 3종 모두 살 수 있다. 자기 과로 제한하면
// 유저당 1개뿐이라 "고르고 전환한다"는 행위가 사라진다.
//
// design.md: 타일 버튼이 여러 개이므로 전부 ghost다. 종족색은 CTA에 쓰지 않는다.
// 이모지는 마스코트 자리(원판·배지)에만 쓴다 — 캐릭터 타일의 얼굴이 그 자리다.

export type SkinRow = {
  id: string
  name: string
  typeCode: TypeCode
  isDefault: boolean
  stageCount: number
  effectType: EffectType
  effectPct: number
  priceAffinity: number | null
  owned: boolean
  active: boolean
}

export type SkinListProps = {
  skins: SkinRow[]
  affinity: number
}

const EFFECT_LABEL: Record<EffectType, string> = {
  NONE: "",
  SEED: "씨앗 획득",
  SHARD: "별조각 획득",
  AFFINITY: "친밀도 획득",
}

export default function SkinList({ skins: initial, affinity: initialAffinity }: SkinListProps) {
  const [skins, setSkins] = useState(initial)
  const [affinity, setAffinity] = useState(initialAffinity)
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
        setAffinity(json.data.affinity)
        setSkins((prev) =>
          prev.map((row) => (row.id === skin.id ? { ...row, owned: true } : row)),
        )
        setNotice(`${skin.name}를 데려왔어요. 전환해서 바로 쓸 수 있어요.`)
      } else {
        setSkins((prev) => prev.map((row) => ({ ...row, active: row.id === skin.id })))
        setNotice(`이제 ${skin.name}와 함께해요.`)
      }
    } catch {
      setError("네트워크 연결을 확인해 주세요")
    } finally {
      setPending(null)
    }
  }

  const groups = [
    { title: "기본 펫", hint: "진단으로 정해져요", rows: skins.filter((row) => row.isDefault) },
    {
      title: "친밀도 캐릭터",
      hint: "진화 없이 단일 형태예요",
      rows: skins.filter((row) => !row.isDefault),
    },
  ]

  return (
    <main className="hm hm--canvas">
      <div className="hm__col hm-pet">
        <div className="hm-status">
          <h1 className="hm-card__title">캐릭터</h1>
          <span className="hm__note">친밀도 {affinity}</span>
        </div>

        <p className="hm__note">
          레벨과 경험치는 캐릭터가 아니라 나에게 붙어 있어요. 바꿔도 그대로예요.
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
                  const price = skin.priceAffinity
                  const tooPoor = price !== null && affinity < price

                  return (
                    <div className="hm-tile hm-pet__cos" key={skin.id}>
                      <span className="hm-tile__face" aria-hidden="true">
                        {animalEmoji(skin.name)}
                      </span>
                      <span className="hm-tile__title">{skin.name}</span>
                      <span className="hm-tile__hint">
                        {tribe.family}
                        {skin.effectType !== "NONE" && skin.effectPct > 0
                          ? ` · ${EFFECT_LABEL[skin.effectType]} +${skin.effectPct}%`
                          : ""}
                      </span>

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
                        // 기본 펫은 진단이 지급한다. 상점에 없다
                        <span className="hm-tile__hint">진단으로 받아요</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => call(skin, "buy")}
                          disabled={pending !== null || tooPoor}
                          aria-disabled={pending !== null || tooPoor}
                          className="hm-btn hm-btn--ghost"
                        >
                          친밀도 {price}
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
