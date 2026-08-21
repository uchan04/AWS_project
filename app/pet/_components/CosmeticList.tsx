"use client"

import { useState } from "react"
import type { Rarity, Slot } from "@prisma/client"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 치장 목록 + 구매 + 착용·해제. (SPEC.md 5절)
//
// design.md 규칙 두 개가 이 화면을 좁힌다.
// - "이모지는 마스코트 자리(원판·배지)에만 쓴다." 치장은 마스코트가 아니라 아이템이므로
//   타일에 이모지를 쓰지 않는다. 이미지가 오면 .hm-tile__face 자리에 <img>가 들어간다
// - Primary CTA는 화면에 하나뿐이다. 타일 버튼이 여러 개이므로 전부 ghost다
//
// 미획득 실루엣: 이미지가 없어 지금은 이름을 --color-muted로 죽이고 가격 버튼을 붙인다.
// 이미지가 오면 .hm-pet__cos--locked가 그 <img>에 filter를 걸면 된다.
//
// 가격은 서버가 내려준 priceAffinity만 쓴다. 등급별 가격표를 여기 복사하면
// prisma/seed/items.ts의 PRICE_BY_RARITY와 갈라진다.

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
  affinity: number
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

export default function CosmeticList({
  items: initial,
  progress: initialProgress,
  affinity: initialAffinity,
}: CosmeticListProps) {
  const [items, setItems] = useState(initial)
  const [owned, setOwned] = useState(initialProgress.owned)
  const [affinity, setAffinity] = useState(initialAffinity)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // 구매. 성공하면 그 타일만 보유로 바꾸고 잔액·진행률을 서버 값으로 맞춘다.
  // 착용은 하지 않는다 — 서버도 equipped: false로 만든다(슬롯당 1개 규칙 때문에
  // 사는 순간 남이 벗겨지면 유저가 되돌릴 수 없다)
  async function buy(item: CosmeticRow) {
    if (pending || item.owned) return
    setPending(item.id)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch("/api/pet/cosmetics/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? "잠시 후 다시 시도해 주세요")
        return
      }

      setAffinity(json.data.affinity)
      setOwned(json.data.owned)
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, owned: true } : row)))
      setNotice(`${item.name}을 모았어요. 착용을 눌러 바로 꾸밀 수 있어요.`)
    } catch {
      setError("네트워크 연결을 확인해 주세요")
    } finally {
      setPending(null)
    }
  }

  async function toggle(item: CosmeticRow) {
    if (pending || !item.owned) return
    const next = !item.equipped
    setPending(item.id)
    setError(null)
    setNotice(null)

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
            {owned} / {initialProgress.total} 수집 · 친밀도 {affinity}
          </span>
        </div>

        <div className="hm-bar" role="presentation">
          <div
            className="hm-bar__fill"
            style={{
              width:
                initialProgress.total > 0 ? `${(owned / initialProgress.total) * 100}%` : "0%",
            }}
          />
        </div>

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
                {rows.map((item) => {
                  const price = item.affinityOnly ? item.priceAffinity : null
                  const tooPoor = price !== null && affinity < price

                  return (
                    <div
                      className={`hm-tile hm-pet__cos${item.owned ? "" : " hm-pet__cos--locked"}`}
                      key={item.id}
                    >
                      <span className="hm-tile__title">{item.name}</span>
                      <span className="hm-tile__hint">
                        {RARITY_LABEL[item.rarity]}
                        {price !== null ? ` · 친밀도 ${price}` : ""}
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
                      ) : price === null ? (
                        // 비매품. 지금 시드에는 없지만 이벤트 지급 아이템이 생기면 여기로 온다
                        <span className="hm-tile__hint">미획득</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => buy(item)}
                          disabled={pending !== null || tooPoor}
                          aria-disabled={pending !== null || tooPoor}
                          className="hm-btn hm-btn--ghost"
                        >
                          {tooPoor ? `친밀도 ${price - affinity} 부족` : `친밀도 ${price}`}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {owned === 0 ? (
          <p className="hm__note">
            아직 모은 치장이 없어요. 친밀도는 챗봇 대화와 커뮤니티 활동으로 모을 수 있어요.
          </p>
        ) : null}
      </div>
    </main>
  )
}
