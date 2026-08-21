"use client"

import { useState } from "react"
import Link from "next/link"
import type { Rarity, Slot, TypeCode } from "@prisma/client"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 치장 목록 + 구매 + 착용·해제. (SPEC.md 5절)
//
// 2026-08-21: 옛 .hm-pet 어휘를 걷고 펫 홈과 같은 .pet 스코프로 옮겼다. 홈에서
// 나무판("배경 상점")을 눌러 들어오는 화면이라 색·테두리·나무판이 이어져야 한다.
// data-tribe가 --tribe를 켜므로 typeCode를 페이지에서 받는다 — 치장 자체는 종족과
// 무관하지만(SPEC.md 2절) 화면 색은 종족을 따른다.
//
// design.md 규칙 두 개가 이 화면을 좁힌다.
// - "이모지는 마스코트 자리(원판·배지)에만 쓴다." 치장은 마스코트가 아니라 아이템이므로
//   타일에 얼굴 칸을 두지 않는다. 이미지가 오면 .pet-item__img로 <img>가 들어간다
// - 채운 종족색 면은 화면에 하나다. 착용 중인 칸(.pet-item--on)이 그 하나를 갖고,
//   타일 버튼은 전부 ghost(테두리만 종족색)다
//
// 미획득 실루엣: 이미지가 없어 지금은 점선 테두리 + 죽인 이름으로 표현한다.
// 이미지가 오면 .pet-item--locked가 그 <img>에 filter를 걸면 된다.
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
  /** .pet 스코프의 --tribe를 켜는 값. 진단 전이면 null이고 tokens.css :root 기본색으로 떨어진다 */
  typeCode: TypeCode | null
}

const ko = (n: number) => n.toLocaleString("ko-KR")

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
  typeCode,
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

  const progressText = `${owned} / ${initialProgress.total} 수집`

  return (
    <main className="pet pet--shop" data-tribe={typeCode ?? undefined}>
      <div className="pet__top">
        <div>
          <h1 className="pet__title">배경 상점</h1>
          <p className="pet__lede">친밀도로 모아요. 별도 도감 없이 이 화면이 수집함이에요.</p>
        </div>

        <div className="pet__top-acts">
          {/* 잔액이 이 화면에만 있으므로 홈의 씨앗 HUD처럼 aria-hidden으로 묻지 않는다 */}
          <p className="pet-hud" aria-label={`친밀도 ${ko(affinity)}`}>
            {/* --wood 변형은 2026-08-21에 지웠다. 아이콘 칸이 종족색 하나로 통일됐다 */}
            <span className="pet-hud__icon" aria-hidden="true">
              💛
            </span>
            <span className="pet-hud__value" aria-hidden="true">
              {ko(affinity)}
            </span>
          </p>
          <Link className="pet-plank" href="/pet">
            펫으로
          </Link>
        </div>
      </div>

      {/* 수집 진행률. 별도 도감 화면 대신 이 게이지가 겸한다 (SPEC.md 5절 "제외한 것") */}
      <div className="pet-gauge" role="img" aria-label={progressText}>
        <div
          className="pet-gauge__fill"
          style={{
            width: initialProgress.total > 0 ? `${(owned / initialProgress.total) * 100}%` : "0%",
          }}
        />
        <span className="pet-gauge__value" aria-hidden="true">
          {progressText}
        </span>
      </div>

      {error ? (
        <p className="pet-msg pet-msg--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="pet-msg" role="status">
          {notice}
        </p>
      ) : null}

      {SLOTS.map((slot) => {
        const rows = items.filter((item) => item.slot === slot)
        if (rows.length === 0) return null

        return (
          <section className="pet-card" key={slot}>
            <div className="pet-card__head">
              <h2 className="pet-card__title">{SLOT_LABEL[slot]}</h2>
              <span className="pet-card__meta">한 번에 하나만 착용해요</span>
            </div>

            <div className="pet-shop">
              {rows.map((item) => {
                const price = item.affinityOnly ? item.priceAffinity : null
                const tooPoor = price !== null && affinity < price

                return (
                  <div
                    className={`pet-item${item.equipped ? " pet-item--on" : item.owned ? "" : " pet-item--locked"}`}
                    key={item.id}
                  >
                    <span className="pet-item__name">{item.name}</span>
                    <span className="pet-item__meta">
                      {RARITY_LABEL[item.rarity]}
                      {price !== null ? ` · 친밀도 ${ko(price)}` : ""}
                    </span>

                    <div className="pet-item__act">
                      {item.owned ? (
                        <button
                          type="button"
                          onClick={() => toggle(item)}
                          disabled={pending !== null}
                          aria-disabled={pending !== null}
                          aria-pressed={item.equipped}
                          className="pet-btn pet-btn--ghost"
                        >
                          {item.equipped ? "벗기" : "착용"}
                        </button>
                      ) : price === null ? (
                        // 비매품. 지금 시드에는 없지만 이벤트 지급 아이템이 생기면 여기로 온다
                        <span className="pet-item__meta">미획득</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => buy(item)}
                          disabled={pending !== null || tooPoor}
                          aria-disabled={pending !== null || tooPoor}
                          className="pet-btn pet-btn--ghost"
                        >
                          {tooPoor ? `${ko(price - affinity)} 부족` : `친밀도 ${ko(price)}`}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {owned === 0 ? (
        <p className="pet-msg">
          아직 모은 배경이 없어요. 친밀도는 챗봇 대화와 커뮤니티 활동으로 모을 수 있어요.
        </p>
      ) : null}
    </main>
  )
}
