"use client"

import { useState } from "react"
import type { Rarity, Slot } from "@prisma/client"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 치장 목록 + 착용·해제. (SPEC.md 5절)
//
// design.md 규칙 두 개가 이 화면을 좁힌다.
// - "이모지는 마스코트 자리(원판·배지)에만 쓴다." 치장은 마스코트가 아니라 아이템이므로
//   타일에 이모지를 쓰지 않는다. 이미지가 오면 .hm-tile__face 자리에 <img>가 들어간다
// - Primary CTA는 화면에 하나뿐이다. 타일 버튼이 여러 개이므로 전부 ghost다
//
// 미획득 실루엣: 이미지가 없어 지금은 이름을 --color-muted로 죽이고 "미획득"을 붙인다.
// 이미지가 오면 .hm-pet__cos--locked가 그 <img>에 filter를 걸면 된다.

export type CosmeticRow = {
  id: string
  name: string
  slot: Slot
  rarity: Rarity
  affinityOnly: boolean
  priceAffinity: number | null
  owned: boolean
  equipped: boolean
}

export type CosmeticListProps = {
  items: CosmeticRow[]
  progress: { owned: number; total: number }
}

const SLOT_LABEL: Record<Slot, string> = {
  HAT: "모자",
  SCARF: "목도리",
  BACKGROUND: "배경",
}

const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "일반",
  RARE: "희귀",
  EPIC: "영웅",
  LEGENDARY: "전설",
}

const SLOTS: Slot[] = ["HAT", "SCARF", "BACKGROUND"]

export default function CosmeticList({ items: initial, progress }: CosmeticListProps) {
  const [items, setItems] = useState(initial)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(item: CosmeticRow) {
    if (pending || !item.owned) return
    const next = !item.equipped
    setPending(item.id)
    setError(null)

    try {
      const res = await fetch("/api/pet/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, equipped: next }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? "잠시 후 다시 시도해 주세요")
        return
      }

      // 서버가 착용 중인 것 전체를 돌려준다. 그 목록을 그대로 반영하면
      // 같은 슬롯의 이전 착용이 벗겨진 것까지 한 번에 맞는다
      const equippedIds = new Set<string>(
        (json.data.equipped as { itemId: string }[]).map((row) => row.itemId),
      )
      setItems((prev) => prev.map((row) => ({ ...row, equipped: equippedIds.has(row.id) })))
    } catch {
      setError("네트워크 연결을 확인해 주세요")
    } finally {
      setPending(null)
    }
  }

  return (
    <main className="hm hm--canvas">
      <div className="hm__col hm-pet">
        <div className="hm-status">
          <h1 className="hm-card__title">치장</h1>
          <span className="hm__note">
            {progress.owned} / {progress.total} 수집
          </span>
        </div>

        <div className="hm-bar" role="presentation">
          <div
            className="hm-bar__fill"
            style={{
              width: progress.total > 0 ? `${(progress.owned / progress.total) * 100}%` : "0%",
            }}
          />
        </div>

        {error ? (
          <p className="hm-field__help hm-field__help--error" role="alert">
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        ) : null}

        {SLOTS.map((slot) => {
          const rows = items.filter((item) => item.slot === slot)
          if (rows.length === 0) return null

          return (
            <div className="hm-card" key={slot}>
              <div className="hm-card__head">
                <h2 className="hm-card__title">{SLOT_LABEL[slot]}</h2>
                <span className="hm__note">한 번에 하나만 착용해요</span>
              </div>

              <div className="hm-tiles">
                {rows.map((item) => (
                  <div
                    className={`hm-tile hm-pet__cos${item.owned ? "" : " hm-pet__cos--locked"}`}
                    key={item.id}
                  >
                    <span className="hm-tile__title">{item.name}</span>
                    <span className="hm-tile__hint">
                      {RARITY_LABEL[item.rarity]}
                      {item.affinityOnly && item.priceAffinity
                        ? ` · 친밀도 ${item.priceAffinity}`
                        : ""}
                    </span>

                    {item.owned ? (
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        disabled={pending !== null}
                        aria-disabled={pending !== null}
                        aria-pressed={item.equipped}
                        className="hm-btn hm-btn--ghost"
                      >
                        {item.equipped ? "벗기" : "착용"}
                      </button>
                    ) : (
                      <span className="hm-tile__hint">미획득</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {progress.owned === 0 ? (
          <p className="hm__note">
            아직 모은 치장이 없어요. 획득 방법이 정해지면 여기에서 바로 꾸밀 수 있어요.
          </p>
        ) : null}
      </div>
    </main>
  )
}
