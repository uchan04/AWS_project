"use client"

import { useState } from "react"
import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { animalEmoji } from "@/lib/pet"
import { TRIBE } from "@/lib/types"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 스킨 목록 + 구매·전환. (SPEC.md 5절)
//
// 스킨은 자기 종족 전용 외형이다(2026-08-20 결정). 여기 들어오는 목록은 이미
// user.typeCode로 걸러져 있으므로 전부 같은 동물이다. 능력치 효과는 없어졌다 —
// 바뀌는 것은 외형뿐이고 진화 4단은 기본 외형과 같다.
//
// 2026-08-21: 옛 .hm-pet 어휘를 걷고 펫 홈과 같은 .pet 스코프로 옮겼다. 홈에서
// 나무판("외형 상점")을 눌러 들어오는 화면이라 색·테두리·나무판이 이어져야 한다.
// data-tribe가 --tribe를 켜므로 typeCode를 페이지에서 받는다 — 목록 행의 typeCode를
// 쓰지 않는 이유는 목록이 빈 경우(진단 전)에도 스코프가 성립해야 하기 때문이다.
//
// design.md: 칸이 여러 개라 타일 버튼은 전부 ghost(테두리만 종족색)다. 채운 종족색
// 면은 "함께하는 중" 칸 하나가 갖는다. 이모지는 마스코트 자리에만 — 타일 얼굴이 그 자리다.

export type SkinRow = {
  id: string
  name: string
  typeCode: TypeCode
  isDefault: boolean
  stageCount: number
  priceShards: number | null
  owned: boolean
  active: boolean
  /** 성체 그림. public/art에서 온다 (lib/assets.ts). 없으면 이모지로 떨어진다 */
  imageUrl?: string | null
}

export type SkinListProps = {
  skins: SkinRow[]
  starShards: number
  /** .pet 스코프의 --tribe를 켜는 값. 진단 전이면 null이고 tokens.css :root 기본색으로 떨어진다 */
  typeCode: TypeCode | null
}

const ko = (n: number) => n.toLocaleString("ko-KR")

export default function SkinList({
  skins: initial,
  starShards: initialShards,
  typeCode,
}: SkinListProps) {
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
    <main className="pet pet--shop" data-tribe={typeCode ?? undefined}>
      <div className="pet__top">
        <div>
          <h1 className="pet__title">외형 상점</h1>
          <p className="pet__lede">
            레벨과 경험치는 외형이 아니라 나에게 붙어 있어요. 바꿔도 그대로예요.
          </p>
        </div>

        <div className="pet__top-acts">
          {/* 잔액이 이 화면에만 있으므로 홈의 씨앗 HUD처럼 aria-hidden으로 묻지 않는다 */}
          <p className="pet-hud" aria-label={`별조각 ${ko(starShards)}`}>
            <span className="pet-hud__icon pet-hud__icon--wood" aria-hidden="true">
              ⭐
            </span>
            <span className="pet-hud__value" aria-hidden="true">
              {ko(starShards)}
            </span>
          </p>
          <Link className="pet-plank" href="/pet">
            펫으로
          </Link>
        </div>
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

      {groups.map((group) =>
        group.rows.length === 0 ? null : (
          <section className="pet-card" key={group.title}>
            <div className="pet-card__head">
              <h2 className="pet-card__title">{group.title}</h2>
              <span className="pet-card__meta">{group.hint}</span>
            </div>

            <div className="pet-shop">
              {group.rows.map((skin) => {
                const tribe = TRIBE[skin.typeCode]
                const price = skin.priceShards
                const tooPoor = price !== null && starShards < price
                // 기본 외형은 진단이 지급하므로 미획득 실루엣을 씌우지 않는다 (살 수 있는 것이 아니다)
                const locked = !skin.owned && price !== null

                return (
                  <div
                    className={`pet-item${skin.active ? " pet-item--on" : locked ? " pet-item--locked" : ""}`}
                    key={skin.id}
                  >
                    {skin.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="pet-item__img"
                        src={skin.imageUrl}
                        alt=""
                        aria-hidden="true"
                        onError={(e) => {
                          // 그림이 없으면 이모지로 떨어진다 (PetView와 같은 방식)
                          e.currentTarget.style.display = "none"
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                          if (fallback) fallback.style.display = "grid"
                        }}
                      />
                    ) : null}
                    <span
                      className="pet-item__face"
                      aria-hidden="true"
                      style={{ display: skin.imageUrl ? "none" : "grid" }}
                    >
                      {animalEmoji(skin.name)}
                    </span>
                    <span className="pet-item__name">{skin.name}</span>
                    <span className="pet-item__meta">{tribe.family}</span>

                    <div className="pet-item__act">
                      {skin.active ? (
                        <span className="pet-item__state">함께하는 중</span>
                      ) : skin.owned ? (
                        <button
                          type="button"
                          onClick={() => call(skin, "activate")}
                          disabled={pending !== null}
                          aria-disabled={pending !== null}
                          className="pet-btn pet-btn--ghost"
                        >
                          전환
                        </button>
                      ) : price === null ? (
                        // 기본 외형은 진단이 지급한다. 상점에 없다
                        <span className="pet-item__meta">진단으로 받아요</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => call(skin, "buy")}
                          disabled={pending !== null || tooPoor}
                          aria-disabled={pending !== null || tooPoor}
                          className="pet-btn pet-btn--ghost"
                        >
                          별조각 {ko(price)}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ),
      )}
    </main>
  )
}
