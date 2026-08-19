"use client"

import { useState } from "react"
import type { TypeCode } from "@prisma/client"
import { expProgress } from "@/lib/pet"
import { SEED_TO_EXP, TRIBE, expToNextLevel } from "@/lib/types"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 펫 화면 본체. (SPEC.md 5절)
//
// 스타일은 design.md가 정한다. Hallmark · editorial / soft.
// - 종족색은 data-tribe로만 넣는다. style={{ backgroundColor }}를 쓰지 않는다
// - 색 면적은 종족 원판 1개 + 희석된 면 1개까지. 그래서 경험치 바와 CTA는 accent를 쓴다
// - Primary CTA는 화면에 하나뿐이다. 나머지 씨앗 버튼은 ghost다
//
// 이미지 9장이 아직 없어 동물 이모지를 원판 자리에 쓴다. 장식이므로 aria-hidden을 붙이고
// 종족·동물 이름은 옆에 글자로 따로 쓴다.
// imageKey 규칙은 prisma/seed/items.ts에 고정해 뒀으니 이미지가 나오면 <img>로 교체한다.

export type PetState = {
  level: number
  exp: number
  evolutionStage: number
  seeds: number
  animal: string
  family: string
  colorName: string
  skinName: string
  stageCount: number
  effectLabel: string | null
  // 진단 전이면 null이다. data-tribe를 붙이지 않아 --tribe가 accent로 남는다
  typeCode: TypeCode | null
}

// 친밀도 전용 캐릭터 3종. 기본 3종은 TRIBE가 정본이라 여기 적지 않는다.
const AFFINITY_EMOJI: Record<string, string> = {
  늑대: "🐺",
  삵: "🐆",
  판다: "🐼",
}

const ANIMAL_EMOJI: Record<string, string> = {
  ...Object.fromEntries(Object.values(TRIBE).map((tribe) => [tribe.animal, tribe.emoji])),
  ...AFFINITY_EMOJI,
}

export default function PetView({ initial }: { initial: PetState }) {
  const [pet, setPet] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evolvedTo, setEvolvedTo] = useState<number | null>(null)

  const need = expToNextLevel(pet.level)
  const progress = expProgress(pet.level, pet.exp)
  const emoji = ANIMAL_EMOJI[pet.animal] ?? "🐾"
  // 단일 형태(친밀도 캐릭터)는 단계 크기를 쓰지 않는다
  const stage = pet.stageCount > 1 ? Math.min(pet.evolutionStage, 3) : 2

  async function feed(seeds: number) {
    if (pending || seeds < 1 || seeds > pet.seeds) return
    setPending(true)
    setError(null)

    try {
      const res = await fetch("/api/pet/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seeds }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? "잠시 후 다시 시도해 주세요")
        return
      }

      const next = json.data
      setPet((prev) => ({
        ...prev,
        level: next.level,
        exp: next.exp,
        evolutionStage: next.evolutionStage,
        seeds: next.seeds,
      }))

      // 진화 풀스크린 연출 2초 (SPEC.md 5절)
      if (next.evolvedTo) {
        setEvolvedTo(next.evolvedTo)
        setTimeout(() => setEvolvedTo(null), 2000)
      }
    } catch {
      setError("네트워크 연결을 확인해 주세요")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="hm hm--canvas" data-tribe={pet.typeCode ?? undefined}>
      <div className="hm__col hm-pet">
        <div className="hm-status">
          <h1 className="hm-card__title">{pet.skinName}</h1>
          <span className="hm__note">{pet.family}</span>
        </div>

        <div className="hm-plate hm-plate--hero hm-pet__plate" data-stage={stage}>
          <span className="hm-plate__disc hm-float" aria-hidden="true">
            {emoji}
          </span>
          <span className="hm-plate__animal">{pet.animal}</span>
          <span className="hm-plate__caption">
            {pet.stageCount > 1 ? `${pet.evolutionStage}단계` : "단일 형태"} · {pet.colorName}
          </span>
          {pet.effectLabel ? <span className="hm-pill">{pet.effectLabel}</span> : null}
        </div>

        <div className="hm-card">
          <div className="hm-status">
            <span className="hm-row__label">Lv. {pet.level}</span>
            <span className="hm__note">
              경험치 {pet.exp} / {need}
            </span>
          </div>
          <div
            className="hm-bar"
            role="progressbar"
            aria-label="다음 레벨까지 경험치"
            aria-valuemin={0}
            aria-valuemax={need}
            aria-valuenow={pet.exp}
          >
            <div className="hm-bar__fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        <div className="hm-card">
          <div className="hm-status">
            <span className="hm-row__label">가진 씨앗</span>
            <span className="hm__note">{pet.seeds}개</span>
          </div>

          <div className="hm-pet__acts">
            {[10, 100].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => feed(amount)}
                disabled={pending || pet.seeds < amount}
                aria-disabled={pending || pet.seeds < amount}
                className="hm-btn hm-btn--ghost"
              >
                씨앗 {amount}
              </button>
            ))}
            <button
              type="button"
              onClick={() => feed(pet.seeds)}
              disabled={pending || pet.seeds < 1}
              aria-disabled={pending || pet.seeds < 1}
              className="hm-btn"
            >
              전부 넣기
            </button>
          </div>

          <p className="hm__note">씨앗 1개는 경험치 {SEED_TO_EXP}이 돼요.</p>

          {error ? (
            <p className="hm-field__help hm-field__help--error" role="alert">
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {evolvedTo ? (
        <div className="hm-pet__evolve" role="status">
          <span className="hm-plate__disc hm-bounce" aria-hidden="true">
            {emoji}
          </span>
          <p className="hm-pet__evolve-title">{evolvedTo}단계로 진화했어요</p>
          <p className="hm__note">{pet.skinName}가 한 단계 자랐습니다</p>
        </div>
      ) : null}
    </main>
  )
}
