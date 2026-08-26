"use client"

import { useState } from "react"

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
// 2026-08-24: 외형 상점과 같은 구성으로 맞췄다(사용자 요청 "두 화면 모두") —
// 배너 · 착용 중 카드 · 🌼 구분선 · 탭 3개 · 코너 배지 · 빈 상태 · 끝 장식.
// 슬롯별 3개 섹션을 탭 하나로 접었다: 지금 상품이 배경 6종뿐이라 섹션 둘이 늘 비어
// 있었고, 시안의 "전체 / 보유 중 / 구매 가능"과 슬롯 구분을 함께 두면 제목이 두 겹이
// 된다. 슬롯은 타일 메타(🏞️ 배경)로 남아 있으므로 모자·목도리가 붙어도 구분은 된다.
// 섹션 제목을 "배경"이 아니라 "아이템"으로 쓰는 이유도 그것이다.
//
// design.md 규칙 두 개가 이 화면을 좁힌다.
// - "이모지는 마스코트 자리(원판·배지)에만 쓴다." 치장은 마스코트가 아니라 아이템이므로
//   타일에 얼굴 칸을 두지 않는다. 이미지가 오면 .pet-item__img로 <img>가 들어간다
// - 채운 종족색 면은 화면에 하나다. 고른 탭이 그 하나를 갖고, 희석된 면은 착용 중인
//   칸(.pet-item--on)과 그것을 가리키는 카드가 나눠 갖는다. 타일 버튼은 전부 ghost다
//
// 미획득 실루엣: 이미지가 없어 지금은 점선 테두리 + 죽인 이름으로 표현한다.
// 이미지가 오면 .pet-item--locked가 그 <img>에 filter를 걸면 된다.
//
// 가격은 서버가 내려준 priceShards만 쓴다. 등급별 가격표를 여기 복사하면
// prisma/seed/items.ts의 PRICE_BY_RARITY와 갈라진다.
//
// 2026-08-25: 값을 치르는 재화가 친밀도 → **별조각**이 됐다(사용자 결정). 이 화면에서
// 바뀌는 것은 아이콘(❤️ → ⭐)·문구·잔액 세 곳이고 구조는 그대로다. 전환 고지 한 줄을
// 진행률 아래에 둔다 — 어제까지 친밀도로 사던 사람이 잔액이 그대로인 것을 보고
// "내 친밀도가 어디 갔나"로 읽지 않게 하는 것이 그 줄의 일이다.

export type CosmeticRow = {
  id: string
  name: string
  slot: Slot
  rarity: Rarity
  /** 별조각 구매가. null이면 비매품이고 화면은 버튼 대신 "미획득"을 띄운다 */
  priceShards: number | null
  /** 타일 미리보기 그림. CLOUDFRONT_DOMAIN이 비었으면 null이고 타일은 이름만 보인다 */
  imageUrl: string | null
  owned: boolean
  equipped: boolean
}

export type CosmeticListProps = {
  items: CosmeticRow[]
  progress: { owned: number; total: number }
  /** 별조각 잔액. 외형 상점(/pet/skins)이 보는 것과 같은 값이다 (2026-08-25 전환) */
  starShards: number
  /** .pet 스코프의 --tribe를 켜는 값. 진단 전이면 null이고 tokens.css :root 기본색으로 떨어진다 */
  typeCode: TypeCode | null
}

// ArtImage(next/image)를 쓰지 않는다. 타일 그림이 CloudFront 절대 URL이 된 뒤로는
// 최적화기를 통과시킬 이유가 없고(그 파일 주석 참고), 여기 <img>는 실패할 때 자기만
// 숨는 게 아니라 흰 액자(.pet-item__thumb)까지 같이 숨겨야 해서 onError가 다르다
const ko = (n: number) => n.toLocaleString("ko-KR")

const SLOT_LABEL: Record<Slot, string> = {
  HAT: "모자",
  SCARF: "목도리",
  BACKGROUND: "배경",
}

// 슬롯 이모지 (2026-08-24). 글자 앞에 aria-hidden 스팬 하나이므로 스크린리더가 읽는
// 이름은 위 SLOT_LABEL 그대로다. 배경은 🖼️가 아니라 🏞️다: 8/22에 그림 6장의 흰 액자를
// 잘라낸 화면이라 액자를 다시 놓으면 방금 걷어낸 것을 가리킨다. 실제 상품이 계절 풍경
// 6종이기도 하다.
const SLOT_EMOJI: Record<Slot, string> = {
  HAT: "🎩",
  SCARF: "🧣",
  BACKGROUND: "🏞️",
}

const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "일반",
  RARE: "희귀",
  EPIC: "영웅",
  LEGENDARY: "전설",
}

// 목록 걸러보기 (2026-08-24, 시안의 탭 3개)
type Tab = "all" | "owned" | "shop"

const TABS: { key: Tab; label: string; icon: string; title: string }[] = [
  { key: "all", label: "전체", icon: "🌿", title: "모든 아이템" },
  { key: "owned", label: "보유 중", icon: "🧺", title: "보유 중인 아이템" },
  { key: "shop", label: "구매 가능", icon: "🛍️", title: "구매 가능한 아이템" },
]

export default function CosmeticList({
  items: initial,
  progress: initialProgress,
  starShards: initialShards,
  typeCode,
}: CosmeticListProps) {
  const [items, setItems] = useState(initial)
  const [owned, setOwned] = useState(initialProgress.owned)
  const [starShards, setStarShards] = useState(initialShards)
  const [tab, setTab] = useState<Tab>("all")
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [previewItem, setPreviewItem] = useState<CosmeticRow | null>(null)

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

      setStarShards(json.data.starShards)
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


  const filtered =
    tab === "owned"
      ? items.filter((row) => row.owned)
      : tab === "shop"
        ? items.filter((row) => !row.owned)
        : items
  const sectionTitle = TABS.find((t) => t.key === tab)!.title

  return (
    <div className="pet-section" data-tribe={typeCode ?? undefined}>
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

      {/* role="tab"을 쓰지 않는다 — 패널이 하나이고 화살표 키 이동까지 만들 화면이 아니다.
          누른 상태는 aria-pressed가 나른다 */}
      <div className="pet-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className="pet-tab"
            data-active={tab === t.key}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="pet-shop-head">
        <h2 className="pet-shop-head__title">
          <span className="pet-shop-head__bar" aria-hidden="true" />
          {sectionTitle}
        </h2>
        <span className="pet-shop-head__count">{filtered.length}개</span>
      </div>

      {filtered.length === 0 ? (
        <div className="pet-empty">
          <span className="pet-empty__face" aria-hidden="true">
            🌿
          </span>
          <span>이 칸에 보여 줄 아이템이 없어요</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const price = item.priceShards
            const tooPoor = price !== null && starShards < price
            // 등급 배지는 두 갈래다: 일반은 캔버스색, 희귀 이상은 종족색 칩.
            // 에픽 전용 색은 만들지 않았다(2026-08-24 사용자 결정 — 시드에 없다).
            // 글자는 RARITY_LABEL 그대로이므로 영웅·전설이 붙어도 이름은 맞는다
            const rare = item.rarity !== "COMMON"

            return (
              <div
                className={`pet-item${rare ? " pet-item--rare" : ""}${item.equipped ? " pet-item--on" : item.owned ? "" : " pet-item--locked"}`}
                key={item.id}
              >
                <span className="pet-item__tag pet-item__tag--rarity" data-rare={rare}>
                  {RARITY_LABEL[item.rarity]}
                </span>
                {item.equipped ? (
                  <span className="pet-item__tag pet-item__tag--on">착용 중</span>
                ) : item.owned ? (
                  <span className="pet-item__tag pet-item__tag--own">보유</span>
                ) : null}

                {/* 배경 그림. 사기 전에 무엇인지 보여야 한다 — 이름과 가격만 있으면
                    별조각 500(약 8일치)을 무엇인지 모르고 내는 화면이 된다.
                    안 뜨면 스스로 숨어 이름만 남는다(PetRoom의 배경 <img>와 같은 처리).
                    장식이 아니라 상품 정보이므로 aria-hidden이 아니고, 이름이 옆에
                    글자로 있으므로 alt는 빈 값이다 — 읽으면 이름이 두 번 나온다 */}
                {item.imageUrl ? (
                  // 감싸는 span은 흰 액자 테두리를 자르는 창이다 (2026-08-22).
                  // 그림 6장에 추출이 덜 된 흰 여백이 남아 있어 pet.css가 <img>를
                  // 1.2배로 확대하는데, 자르는 쪽(overflow: hidden)이 없으면 확대분이
                  // 타일 밖으로 삐져나온다. 방은 .pet-room이 그 역할을 이미 한다
                  <span className="pet-item__thumb" onClick={() => setPreviewItem(item)} style={{ cursor: "pointer" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="pet-item__img"
                      src={item.imageUrl}
                      alt=""
                      // 6장 합쳐 약 3MB다(장당 약 500KB, 810×324). 접힘 아래 칸은
                      // 스크롤할 때 받게 미룬다 — 상점에 들어오는 순간 3MB를 다 받으면
                      // 모바일에서 첫 화면이 늦는다
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        // 창까지 같이 숨긴다. <img>만 숨기면 빈 창이 남아 그림이
                        // 안 온 칸에 회색 판이 놓인다
                        const frame = e.currentTarget.closest(".pet-item__thumb")
                        if (frame instanceof HTMLElement) frame.style.display = "none"
                      }}
                    />
                  </span>
                ) : null}

                <span className="pet-item__name">{item.name}</span>
                <span className="pet-item__meta">
                  <span aria-hidden="true">{SLOT_EMOJI[item.slot]}</span> {SLOT_LABEL[item.slot]}
                  {price !== null ? <> · ⭐ {ko(price)}</> : ""}
                </span>

                <div className="pet-item__act">
                  {item.equipped ? (
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      disabled={pending !== null}
                      aria-disabled={pending !== null}
                      className="pet-btn pet-btn--ghost"
                    >
                      벗기
                    </button>
                  ) : item.owned ? (
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      disabled={pending !== null}
                      aria-disabled={pending !== null}
                      className="pet-btn pet-btn--ghost"
                    >
                      착용
                    </button>
                  ) : price === null ? (
                    <span className="pet-item__meta">미획득</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buy(item)}
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
      )}

      {owned === 0 ? (
        <p className="pet-msg">
          아직 모은 배경이 없어요. 별조각은 일일 미션 전체 완료와 출석, 펫 외출로 모을 수 있어요.
        </p>
      ) : null}

      {previewItem && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.8)", zIndex: 999,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "20px"
        }} onClick={() => setPreviewItem(null)}>
          <div style={{
            backgroundColor: "var(--color-paper, #fff)",
            borderRadius: "16px",
            padding: "20px",
            maxWidth: "1500px",
            width: "95vw",
            position: "relative"
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewItem(null)} style={{ position: "absolute", top: "16px", right: "16px", background: "transparent", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--color-text, #333)" }}>✕</button>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "20px", textAlign: "center", color: "var(--color-text, #333)" }}>{previewItem.name}</h3>
            {previewItem.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewItem.imageUrl} style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "8px", marginBottom: "16px" }} alt="" />
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              {previewItem.owned ? (
                <button 
                  className="pet-btn pet-btn--ghost" 
                  onClick={() => { toggle(previewItem); setPreviewItem(null); }}
                  disabled={pending !== null}
                >
                  {previewItem.equipped ? "벗기" : "착용"}
                </button>
              ) : previewItem.priceShards !== null ? (
                <button 
                  className="pet-btn pet-btn--ghost"
                  onClick={() => { buy(previewItem); setPreviewItem(null); }}
                  disabled={pending !== null || starShards < previewItem.priceShards}
                >
                  별조각 {ko(previewItem.priceShards)} 구매
                </button>
              ) : (
                <span>미획득</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
