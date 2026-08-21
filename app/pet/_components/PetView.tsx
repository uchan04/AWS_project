"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import {
  HUNGER_LOW,
  IDLE_CAP_HOURS,
  IDLE_MAX_SEEDS,
  IDLE_SEEDS_PER_HOUR,
  MS_PER_IDLE_SEED,
  animalEmoji,
  expProgress,
  hungerLabel,
} from "@/lib/pet"
import { EVOLUTION_LEVEL, SEED_TO_EXP, expToNextLevel } from "@/lib/types"
import PetRoom from "./PetRoom"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 펫 화면 본체. (SPEC.md 5절)
//
// 2026-08-21: Figma Make export("Create pet home design")의 펫 홈 레이아웃으로 갈았다.
// 옮기면서 지킨 것과 바꾼 것:
// - 데이터·API 호출은 그대로다. export의 로직(setUserSeeds로 로컬 차감, 씨앗 1 = 8 XP)은
//   버렸다 — 재화를 화면에서 직접 증감하면 calculateReward()를 우회한다(CLAUDE.md 2절)
// - 종족색은 여전히 data-tribe로만 넣는다. style={{ backgroundColor }}를 쓰지 않는다.
//   export의 주황 하드코딩(#E07A45)은 pet.css가 var(--tribe) 파생으로 받는다
// - design.md의 "primary CTA는 화면에 하나" 규칙은 이 화면에서 깨진다. 새 디자인이
//   씨앗 받기(초록)·먹이기(종족색)·상점 2개(나무)를 동시에 두는 게임 HUD 형태다.
//   역할별로 색이 달라 위계는 구분된다. 규칙을 바꾼 것이 아니라 이 화면만 예외다
// - export에 있던 "단계별 씨앗 효율 +10/25/50%"는 지웠다. 구현·명세에 없는 수치다.
//   그 자리에는 실제로 존재하는 스킨 고유 효과(PetSkin.effectPct)를 넣는다
// - 배고픔 게이지는 새로 붙인 기능이다. lib/pet.ts hungerFor()가 계산한다
// - 방 배경: 착용한 배경 치장이 있으면 그 그림, 없으면 PetRoom의 기본 방 SVG다
//   (2026-08-21 사용자 확정). 펫은 배경과 무관하게 방 중앙 하단에 고정한다

export type PetState = {
  level: number
  exp: number
  evolutionStage: number
  seeds: number
  /** 배고픔 0~100. 100이 배부름. 표시 전용이며 재화·성장에 영향이 없다 */
  hunger: number
  /** 방치형으로 모여 있는(아직 안 받은) 씨앗. 배율까지 적용된 값이다 */
  idleSeeds: number
  /** 상한(12시간분)에 닿아 누적이 멈춘 상태인지 */
  idleCapped: boolean
  /** 다음 1개가 쌓이기까지 남은 밀리초. 상단 카운트다운에 쓴다 */
  msToNextSeed: number
  /** 착용 중인 치장 이름 배지 */
  worn: string[]
  animal: string
  family: string
  colorName: string
  skinName: string
  stageCount: number
  effectLabel: string | null
  // 진단 전이면 null이다. data-tribe를 붙이지 않아 --tribe가 accent로 남는다
  typeCode: TypeCode | null
  /** S3 펫 이미지 URL. CloudFront 도메인이 없거나 스킨이 없으면 null */
  imageUrl: string | null
  /** 진화 단계 카드용 단계별 이미지. 원소가 stageCount개다 */
  stageImageUrls: (string | null)[]
  /** 착용한 배경 치장의 이미지. null이면 기본 방 SVG가 나온다 */
  roomImageUrl: string | null
}

// 단계 이름·문구. 단계 임계값은 lib/types.ts(A 소유)의 EVOLUTION_LEVEL이 정본이라
// 여기서는 이름만 갖고 구간 문자열은 그 상수로 만든다.
const STAGE_NAME = ["아기", "청년", "전설"]
const STAGE_DESC = ["어린 시절을 보내고 있어요", "멋지게 자랐어요", "전설이 되었어요"]

function stageRange(stage: number): string {
  if (stage === 1) return `Lv.1 ~ ${EVOLUTION_LEVEL.STAGE2 - 1}`
  if (stage === 2) return `Lv.${EVOLUTION_LEVEL.STAGE2} ~ ${EVOLUTION_LEVEL.STAGE3 - 1}`
  return `Lv.${EVOLUTION_LEVEL.STAGE3}+`
}

/** 다음 진화까지 남은 것. 최종 단계면 null */
function nextMilestone(level: number): string | null {
  if (level < EVOLUTION_LEVEL.STAGE2) return `Lv.${EVOLUTION_LEVEL.STAGE2} 첫 진화`
  if (level < EVOLUTION_LEVEL.STAGE3) return `Lv.${EVOLUTION_LEVEL.STAGE3} 마지막 진화`
  return null
}

const FEED_PRESETS = [1, 10, 50, 100]

const ko = (n: number) => n.toLocaleString("ko-KR")

export default function PetView({ initial }: { initial: PetState }) {
  const [pet, setPet] = useState(initial)
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [evolvedTo, setEvolvedTo] = useState<number | null>(null)
  const [amount, setAmount] = useState(1)
  const [msLeft, setMsLeft] = useState(initial.msToNextSeed)

  const need = expToNextLevel(pet.level)
  const progress = expProgress(pet.level, pet.exp)
  const emoji = animalEmoji(pet.animal)
  // 단일 형태(친밀도 캐릭터)는 단계 크기를 쓰지 않는다. 중간 크기로 고정한다
  const stage = pet.stageCount > 1 ? Math.min(pet.evolutionStage, 3) : 2
  const milestone = nextMilestone(pet.level)
  // evolutionStageFor가 3에서 멈추므로 카드도 3장을 넘기지 않는다
  const stages = Array.from({ length: Math.min(pet.stageCount, 3) }, (_, i) => i + 1)
  const feedable = Math.min(amount, pet.seeds)

  // 토스트 2.5초 후 사라짐
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // 다음 씨앗까지 남은 시간. 표시 전용이다 — 실제 지급량은 받기를 누를 때 서버가 다시 센다.
  // 상한에 닿아 있으면 더 쌓이지 않으므로 돌리지 않는다.
  useEffect(() => {
    if (pet.idleCapped || pet.idleSeeds >= IDLE_MAX_SEEDS) return
    const tick = setInterval(() => {
      setMsLeft((left) => {
        if (left > 1000) return left - 1000
        setPet((prev) =>
          prev.idleSeeds >= IDLE_MAX_SEEDS ? prev : { ...prev, idleSeeds: prev.idleSeeds + 1 },
        )
        return MS_PER_IDLE_SEED
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [pet.idleCapped, pet.idleSeeds])

  async function feed(seeds: number) {
    if (pending || seeds < 1 || seeds > pet.seeds) return
    setPending(true)

    try {
      const res = await fetch("/api/pet/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seeds }),
      })
      const json = await res.json()

      if (!res.ok) {
        setToast({ text: json?.error?.message ?? "잠시 후 다시 시도해 주세요", error: true })
        return
      }

      const next = json.data
      setPet((prev) => ({
        ...prev,
        level: next.level,
        exp: next.exp,
        evolutionStage: next.evolutionStage,
        seeds: next.seeds,
        hunger: next.hunger ?? prev.hunger,
        imageUrl: next.imageUrl ?? prev.imageUrl,
      }))
      setAmount(1)
      setToast({ text: `씨앗 ${ko(seeds)}개를 먹였어요. 경험치 +${ko(seeds * SEED_TO_EXP)}` })

      // 진화 풀스크린 연출 2초 (SPEC.md 5절)
      if (next.evolvedTo) {
        setEvolvedTo(next.evolvedTo)
        setTimeout(() => setEvolvedTo(null), 2000)
      }
    } catch {
      setToast({ text: "네트워크 연결을 확인해 주세요", error: true })
    } finally {
      setPending(false)
    }
  }

  // 방치형 수령. 서버가 지급량을 다시 계산하므로 화면의 숫자를 보내지 않는다 (SPEC.md 5절)
  async function claim() {
    if (pending || pet.idleSeeds < 1) return
    setPending(true)

    try {
      const res = await fetch("/api/pet/idle", { method: "POST" })
      const json = await res.json()

      if (!res.ok) {
        setToast({ text: json?.error?.message ?? "잠시 후 다시 시도해 주세요", error: true })
        return
      }

      const gained = json.data.seeds - pet.seeds
      setPet((prev) => ({ ...prev, seeds: json.data.seeds, idleSeeds: 0, idleCapped: false }))
      setMsLeft(MS_PER_IDLE_SEED)
      setToast({ text: `씨앗 ${ko(Math.max(0, gained))}개를 수확했어요` })
    } catch {
      setToast({ text: "네트워크 연결을 확인해 주세요", error: true })
    } finally {
      setPending(false)
    }
  }

  const petFace = (
    <>
      {pet.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="pet-char__img"
          src={pet.imageUrl}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none"
            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = "block"
          }}
        />
      ) : null}
      <span className="pet-char__emoji" style={{ display: pet.imageUrl ? "none" : "block" }}>
        {emoji}
      </span>
    </>
  )

  return (
    <main className="pet" data-tribe={pet.typeCode ?? undefined}>
      <header className="pet__top">
        <div>
          <h1 className="pet__title">나의 펫</h1>
          <p className="pet__lede">씨앗을 먹이고 함께 성장하세요</p>
        </div>

        <div className="pet__top-acts">
          {/* 보유 씨앗 HUD. 같은 숫자를 아래 "씨앗 투입" 카드가 글자로 다시 쓰므로
              스크린리더에 두 번 읽히지 않게 여기서는 숨긴다 */}
          <p className="pet-hud" aria-hidden="true">
            <span className="pet-hud__icon">🌱</span>
            <span className="pet-hud__value">{ko(pet.seeds)}</span>
          </p>
          <Link className="pet-plank" href="/pet/skins">
            외형 상점
          </Link>
          <Link className="pet-plank" href="/pet/cosmetics">
            배경 상점
          </Link>
        </div>
      </header>

      <div className="pet__grid">
        <div className="pet__col pet__col--room">
          <div className="pet-room">
            <PetRoom imageUrl={pet.roomImageUrl} />
            <div className="pet-room__seeds" aria-hidden="true">
              <span className="pet-room__seed">🌱</span>
              <span className="pet-room__seed">🌿</span>
              <span className="pet-room__seed">🍃</span>
            </div>

            <div className="pet-char" data-stage={stage}>
              <span className="pet-char__badge">Lv.{pet.level}</span>
              {/* 반짝임 3개. 위치·타이밍이 각각 달라 pet.css가 data-i로 구분한다 */}
              <span className="pet-char__sparkle" data-i="1" aria-hidden="true">
                ✨
              </span>
              <span className="pet-char__sparkle" data-i="2" aria-hidden="true">
                ⭐
              </span>
              <span className="pet-char__sparkle" data-i="3" aria-hidden="true">
                ✨
              </span>

              <span className="pet-char__body" aria-hidden="true">
                {petFace}
              </span>
              <span className="pet-char__shadow" aria-hidden="true" />

              <p className="pet-char__name">{pet.skinName}</p>
              <p className="pet-char__desc">
                {pet.stageCount > 1
                  ? (STAGE_DESC[stage - 1] ?? `${stage}단계`)
                  : `${pet.family} · ${pet.colorName}`}
              </p>
              {pet.worn.length > 0 ? (
                <span className="pet-char__worn">
                  {pet.worn.map((name) => (
                    <span className="hm-pill" key={name}>
                      {name}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </div>

          {/* 배고픔. 0이 되어도 잃는 것은 없다 (lib/pet.ts hungerFor 주석) */}
          <div className="pet-card">
            <div className="pet-card__head">
              <p className="pet-card__title">🍽️ 배고픔</p>
              <span className="pet-card__meta">{pet.hunger}%</span>
            </div>
            <div
              className="pet-gauge pet-gauge--hunger"
              data-low={pet.hunger < HUNGER_LOW}
              role="progressbar"
              aria-label="배고픔"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pet.hunger}
            >
              <div className="pet-gauge__fill" style={{ width: `${pet.hunger}%` }} />
            </div>
            <p className="pet-card__foot">{hungerLabel(pet.hunger)}</p>
          </div>
        </div>

        <div className="pet__col">
          {/* 경험치 */}
          <div className="pet-card">
            <div className="pet-card__head">
              <p className="pet-card__title">⭐ 경험치</p>
              <span className="pet-card__meta">
                {ko(pet.exp)} / {ko(need)}
              </span>
            </div>
            <div
              className="pet-gauge"
              role="progressbar"
              aria-label="다음 레벨까지 경험치"
              aria-valuemin={0}
              aria-valuemax={need}
              aria-valuenow={pet.exp}
            >
              <div className="pet-gauge__fill" style={{ width: `${progress * 100}%` }} />
              <span className="pet-gauge__value">
                {ko(pet.exp)} / {ko(need)}
              </span>
            </div>
            <p className="pet-card__foot">
              <span>현재 Lv.{pet.level}</span>
              <span>{milestone ?? "마지막 단계예요"}</span>
            </p>
          </div>

          {/* 방치형 수확 */}
          <div className="pet-card">
            <div className="pet-idle">
              <span className="pet-idle__left">
                <span className="pet-idle__icon" aria-hidden="true">
                  🌱
                </span>
                <span>
                  <span className="pet-idle__label">그동안 쌓인 씨앗</span>
                  <br />
                  <span className="pet-idle__count">{ko(pet.idleSeeds)}</span>
                  <span className="pet-idle__unit">개</span>
                </span>
              </span>
              <button
                type="button"
                className="pet-btn pet-btn--seed"
                onClick={claim}
                disabled={pending || pet.idleSeeds < 1}
                aria-disabled={pending || pet.idleSeeds < 1}
              >
                받기
              </button>
            </div>
            <p className="pet-card__foot">
              <span>
                시간당 {IDLE_SEEDS_PER_HOUR}개, 최대 {IDLE_CAP_HOURS}시간분까지 모여요
              </span>
              {pet.idleCapped ? (
                <em>가득 찼어요</em>
              ) : (
                <em>다음 씨앗까지 {Math.max(1, Math.ceil(msLeft / 60000))}분</em>
              )}
            </p>
          </div>

          {/* 씨앗 투입 */}
          <div className="pet-card">
            <div className="pet-card__head">
              <p className="pet-card__title">🌿 씨앗 투입</p>
              <span className="pet-card__meta">보유 {ko(pet.seeds)}개</span>
            </div>

            <div className="pet-step">
              <button
                type="button"
                className="pet-step__btn"
                onClick={() => setAmount((a) => Math.max(1, a - 1))}
                disabled={amount <= 1}
                aria-label="한 개 줄이기"
              >
                −
              </button>
              <p>
                <span className="pet-step__value">{ko(amount)}</span>
                <span className="pet-step__unit">개</span>
              </p>
              <button
                type="button"
                className="pet-step__btn"
                onClick={() => setAmount((a) => Math.min(Math.max(1, pet.seeds), a + 1))}
                disabled={amount >= pet.seeds}
                aria-label="한 개 늘리기"
              >
                +
              </button>
            </div>

            {/* export는 1·5·10·20이었다. 씨앗 1 = 경험치 10이고 Lv.1→2가 100이라
                실제 경제(일일 미션 60/일)에 맞춰 1·10·50·100으로 잡았다 */}
            <div className="pet-presets">
              {FEED_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="pet-preset"
                  aria-pressed={amount === p}
                  onClick={() => setAmount(p)}
                  disabled={p > pet.seeds}
                >
                  {ko(p)}개
                </button>
              ))}
            </div>

            <button
              type="button"
              className="pet-btn pet-btn--block"
              onClick={() => feed(feedable)}
              disabled={pending || pet.seeds < 1 || amount > pet.seeds}
              aria-disabled={pending || pet.seeds < 1 || amount > pet.seeds}
            >
              씨앗 {ko(amount)}개 먹이기 🌱
            </button>

            <p className="pet-card__foot">
              <span>씨앗 1개는 경험치 {SEED_TO_EXP}이 돼요</span>
            </p>
          </div>
        </div>
      </div>

      {/* 진화 단계 */}
      <section className="pet-card pet-evo">
        <div className="pet-card__head">
          <h2 className="pet-card__title">🌟 진화 단계</h2>
          {pet.effectLabel ? <span className="pet-card__meta">{pet.effectLabel}</span> : null}
        </div>
        <div className="pet-evo__list">
          {stages.map((s) => {
            const unlocked = pet.evolutionStage >= s
            const current = pet.evolutionStage === s
            const img = pet.stageImageUrls[s - 1]
            return (
              <div
                key={s}
                className={`pet-evo-card${current ? " pet-evo-card--now" : ""}${
                  unlocked ? "" : " pet-evo-card--locked"
                }`}
              >
                {current ? <span className="pet-evo-card__now">현재</span> : null}
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="pet-evo-card__img" src={img} alt="" aria-hidden="true" />
                ) : (
                  <span className="pet-evo-card__emoji" aria-hidden="true">
                    {emoji}
                  </span>
                )}
                {!unlocked ? (
                  <span className="pet-evo-card__lock" aria-hidden="true">
                    🔒
                  </span>
                ) : null}
                <span className="pet-evo-card__stage">
                  {s}단계{unlocked ? "" : " · 잠김"}
                </span>
                <span className="pet-evo-card__label">{STAGE_NAME[s - 1] ?? `${s}단계`}</span>
                <span className="pet-evo-card__range">{stageRange(s)}</span>
                {current && pet.effectLabel ? (
                  <span className="pet-evo-card__effect">{pet.effectLabel}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {toast ? (
        <p
          className={`pet-toast${toast.error ? " pet-toast--error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? "⚠ " : "🌱 "}
          {toast.text}
        </p>
      ) : null}

      {evolvedTo ? (
        <div className="hm-pet__evolve" role="status">
          <span className="pet-char__body" aria-hidden="true">
            {petFace}
          </span>
          <p className="hm-pet__evolve-title">{evolvedTo}단계로 진화했어요</p>
          <p className="hm__note">{pet.skinName}가 한 단계 자랐습니다</p>
        </div>
      ) : null}
    </main>
  )
}
