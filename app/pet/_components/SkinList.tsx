"use client"

import { useState, type SyntheticEvent } from "react"
import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { animalEmoji } from "@/lib/pet"
import { ArtImage } from "@/app/components/ArtImage"
import { CurrencyIcon } from "@/app/components/CurrencyIcon"
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
// 2026-08-24: Figma Make export("상점 디자인 수정 요청")의 구성을 옮겼다 —
// 배너 · 착용 중 카드 · 🌼 구분선 · 탭 3개 · 코너 배지(등급 / 보유·착용) · 빈 상태 ·
// 끝 장식. **색은 옮기지 않았다**(사용자 결정): export의 나무갈색 띠와 크림 배경은
// 현재 펫 화면의 배경색(--color-paper-2 / --color-paper)이 되고, 등급 3색(초록·파랑·보라)은
// 종족색 진하기로 갈리고 에픽은 만들지 않는다. 자세한 이유는 pet.css "상점 배너" 절.
//
// design.md: 칸이 여러 개라 타일 버튼은 전부 ghost(테두리만 종족색)다. 채운 종족색
// 면은 고른 탭 하나가 갖고, 희석된 면은 착용 중인 칸(과 그것을 가리키는 카드)이 갖는다.
// 이모지는 마스코트 자리에만 — 타일 얼굴이 그 자리다.

export type SkinRow = {
  id: string
  name: string
  typeCode: TypeCode
  isDefault: boolean
  stageCount: number
  priceShards: number | null
  /**
   * 타일 그림. **유저의 현재 진화 단계**다(2026-08-24 사용자 결정) — 성체 고정이 아니다.
   * 주소는 lib/assets.ts의 petImageUrl이 만든다. CLOUDFRONT_DOMAIN이 비면 null이고
   * 타일은 이모지로 떨어진다.
   * 이 필드를 두 브랜치가 각각 추가해 8/24 머지에서 겹쳤다. optional이 아닌 쪽으로 남긴다 —
   * 유일한 호출부(app/pet/skins/page.tsx)가 항상 채우고, optional이면 안 채운 화면이
   * 조용히 이모지로 떨어지는 것을 타입이 잡아 주지 못한다
   */
  imageUrl: string | null
  owned: boolean
  active: boolean
}

export type SkinListProps = {
  skins: SkinRow[]
  starShards: number
  /** .pet 스코프의 --tribe를 켜는 값. 진단 전이면 null이고 tokens.css :root 기본색으로 떨어진다 */
  typeCode: TypeCode | null
}

const ko = (n: number) => n.toLocaleString("ko-KR")

// 목록 걸러보기 (2026-08-24, export의 탭 3개). 기본 외형은 언제나 보유 중이므로
// "구매 가능"에는 변종만 남는다
type Tab = "all" | "owned" | "shop"

const TABS: { key: Tab; label: string; icon: string; title: string }[] = [
  { key: "all", label: "전체", icon: "🌿", title: "모든 외형" },
  { key: "owned", label: "보유 중", icon: "🧺", title: "보유 중인 외형" },
  { key: "shop", label: "구매 가능", icon: "🛍️", title: "구매 가능한 외형" },
]

// 그림이 실패하면 자기를 숨기고 바로 뒤 이모지 스팬을 켠다. 방의 캐릭터
// (PetView의 .pet-char__img)와 같은 폴백이다 — 둘 다 aria-hidden이고 이름이 글자로
// 따로 있으므로 스크린리더가 읽는 것은 이름 한 번이다
function swapToEmoji(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = "none"
  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
  if (fallback) fallback.style.display = "grid"
}

export default function SkinList({
  skins: initial,
  starShards: initialShards,
  typeCode,
}: SkinListProps) {
  const [skins, setSkins] = useState(initial)
  const [starShards, setStarShards] = useState(initialShards)
  const [tab, setTab] = useState<Tab>("all")
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

  const active = skins.find((row) => row.active) ?? null
  const filtered =
    tab === "owned"
      ? skins.filter((row) => row.owned)
      : tab === "shop"
        ? skins.filter((row) => !row.owned)
        : skins
  const sectionTitle = TABS.find((t) => t.key === tab)!.title

  return (
    <main className="pet pet--shop" data-tribe={typeCode ?? undefined}>
      <header className="pet-banner">
        <span className="pet-banner__deco" data-i="1" aria-hidden="true">
          🌿
        </span>
        <span className="pet-banner__deco" data-i="2" aria-hidden="true">
          🍃
        </span>
        <span className="pet-banner__deco" data-i="3" aria-hidden="true">
          🌸
        </span>
        <span className="pet-banner__deco" data-i="4" aria-hidden="true">
          ✨
        </span>

        <div className="pet-banner__inner">
          <div>
            <span className="pet-banner__eyebrow" aria-hidden="true">
              ✦ APPEARANCE SHOP ✦
            </span>
            <h1 className="pet__title">외형 상점</h1>
            <p className="pet__lede">
              레벨과 경험치는 외형이 아니라 나에게 붙어 있어요. 바꿔도 그대로예요.
            </p>
          </div>

          <div className="pet-banner__acts">
            {/* 잔액이 이 화면에만 있으므로 홈의 씨앗 HUD처럼 aria-hidden으로 묻지 않는다 */}
            <p className="pet-hud" aria-label={`별조각 ${ko(starShards)}`}>
              {/* --wood 변형은 2026-08-21에 지웠다. 아이콘 칸이 종족색 하나로 통일됐다 */}
              <span className="pet-hud__icon" aria-hidden="true">
                <CurrencyIcon currency="starShard" size={18} />
              </span>
              <span className="pet-hud__value" aria-hidden="true">
                {ko(starShards)}
              </span>
            </p>
            <Link className="pet-plank" href="/pet">
              <span aria-hidden="true">🐾</span> 펫으로
            </Link>
          </div>
        </div>
      </header>

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

      {/* 지금 데리고 있는 외형 한 장. 격자 안의 --on 칸과 같은 면을 쓴다(pet.css .pet-hero) */}
      {active ? (
        <div className="pet-hero">
          <span className="pet-hero__face">
            {active.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="pet-hero__img"
                src={active.imageUrl}
                alt=""
                aria-hidden="true"
                decoding="async"
                onError={swapToEmoji}
              />
            ) : null}
            <span aria-hidden="true" style={{ display: active.imageUrl ? "none" : "grid" }}>
              {animalEmoji(active.name)}
            </span>
          </span>

          <div className="pet-hero__body">
            <span className="pet-hero__eyebrow">
              {active.isDefault ? "기본 외형 · 진단으로 받았어요" : "상점에서 데려왔어요"}
            </span>
            <span className="pet-hero__name">{active.name}</span>
            <span className="pet-hero__meta">{TRIBE[active.typeCode].family}</span>
          </div>

          <span className="pet-hero__badge">
            함께하는 중 <span aria-hidden="true">🐾</span>
          </span>
        </div>
      ) : null}

      <div className="pet-divider" aria-hidden="true">
        🌼
      </div>

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
          <span>이 칸에 보여 줄 외형이 없어요</span>
        </div>
      ) : (
        <div className="pet-shop">
          {filtered.map((skin) => {
            const tribe = TRIBE[skin.typeCode]
            const price = skin.priceShards
            const tooPoor = price !== null && starShards < price
            // 기본 외형은 진단이 지급하므로 미획득 실루엣을 씌우지 않는다 (살 수 있는 것이 아니다)
            const locked = !skin.owned && price !== null
            // 등급은 PetSkin에 컬럼이 없다. 기본 외형 = 일반 / 변종 = 희귀로 파생한다 —
            // 시안이 고양이를 일반, 북극고양이를 희귀로 그린 것과 같은 가름이다
            const rare = !skin.isDefault

            return (
              <div
                className={`pet-item${rare ? " pet-item--rare" : ""}${skin.active ? " pet-item--on" : locked ? " pet-item--locked" : ""}`}
                key={skin.id}
              >
                <span className="pet-item__tag pet-item__tag--rarity" data-rare={rare}>
                  {rare ? "희귀" : "일반"}
                </span>
                {skin.active ? (
                  <span className="pet-item__tag pet-item__tag--on">착용 중</span>
                ) : skin.owned ? (
                  <span className="pet-item__tag pet-item__tag--own">보유</span>
                ) : null}

                {/* 2026-08-24: 이모지 자리에 실제 외형 그림이 온다. 그림이 실패하면 자기를
                    숨기고 바로 뒤 이모지 스팬을 켠다. 둘 다 aria-hidden이고 이름이
                    아래 글자로 있으므로 스크린리더가 읽는 것은 이름 한 번이다.

                    같은 기능을 이 브랜치와 develop이 각각 만들어 8/24 머지에서 겹쳤다.
                    develop 쪽(<ArtImage>)을 남긴 것은 사용자 결정이다 — 그 컴포넌트가
                    CloudFront 주소와 public/art 파일을 갈라 다루고(외부 도메인은
                    next/image 최적화기를 통과시키면 렌더 중에 throw한다) 같은 폴백 블록을
                    복사해 갖고 있던 7곳을 한 곳으로 모은다. 클래스도 develop의
                    .pet-item__img로 맞췄다 — 배경 타일과 이름이 한 벌이 된다 */}
                {skin.imageUrl ? (
                  <ArtImage
                    className="pet-item__img"
                    src={skin.imageUrl}
                    // 표시 크기다(원본 픽셀이 아니다). pet.css의 3.5rem = 56px
                    width={56}
                    height={56}
                    decorative
                    fallbackDisplay="grid"
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
      )}

      <div className="pet-foot-deco" aria-hidden="true">
        <span>🍀</span>
        <span>✦</span>
        <span>🌸</span>
        <span>✦</span>
        <span>🍀</span>
      </div>
    </main>
  )
}
