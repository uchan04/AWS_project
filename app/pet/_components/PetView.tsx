"use client"

import { useState } from "react"
import { expProgress } from "@/lib/pet"
import { expToNextLevel } from "@/lib/types"

// 소유자: C. 펫 화면 본체. (SPEC.md 5절)
// 이미지 9장이 아직 없어 동물 이모지를 단계별 크기로 대체한다.
// imageKey 규칙은 prisma/seed/items.ts에 고정해 뒀으니 이미지가 나오면 <img>로 교체한다.

export type PetState = {
  level: number
  exp: number
  evolutionStage: number
  seeds: number
  animal: string
  family: string
  colorHex: string
  skinName: string
  stageCount: number
  effectLabel: string | null
}

const ANIMAL_EMOJI: Record<string, string> = {
  여우: "🦊",
  고양이: "🐱",
  곰: "🐻",
  늑대: "🐺",
  삵: "🐆",
  판다: "🐼",
}

// 진화 단계별 크기. CSS transform 수준으로만 한다 (SPEC.md 5절)
const STAGE_SCALE = ["text-6xl", "text-7xl", "text-8xl"]

export default function PetView({ initial }: { initial: PetState }) {
  const [pet, setPet] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evolvedTo, setEvolvedTo] = useState<number | null>(null)

  const need = expToNextLevel(pet.level)
  const progress = expProgress(pet.level, pet.exp)
  const emoji = ANIMAL_EMOJI[pet.animal] ?? "🐾"
  const scale = STAGE_SCALE[Math.min(pet.evolutionStage, STAGE_SCALE.length) - 1]

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">{pet.skinName}</h1>
        <span className="text-sm text-neutral-500">{pet.family}</span>
      </header>

      <section
        className="flex flex-col items-center gap-4 rounded-2xl py-10"
        style={{ backgroundColor: `${pet.colorHex}1a` }}
      >
        <div className={`${scale} transition-transform duration-500`} aria-hidden>
          {emoji}
        </div>
        <p className="text-sm text-neutral-600">
          {pet.stageCount > 1 ? `${pet.evolutionStage}단계` : "단일 형태"}
          {pet.effectLabel ? ` · ${pet.effectLabel}` : ""}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Lv. {pet.level}</span>
          <span className="text-neutral-500">
            {pet.exp} / {need}
          </span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-neutral-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={need}
          aria-valuenow={pet.exp}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress * 100}%`, backgroundColor: pet.colorHex }}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-neutral-600">가진 씨앗</span>
          <span className="font-medium">{pet.seeds}개</span>
        </div>

        <div className="flex gap-2">
          {[10, 100].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => feed(amount)}
              disabled={pending || pet.seeds < amount}
              className="flex-1 rounded-xl border border-neutral-300 py-3 text-sm font-medium disabled:opacity-40"
            >
              씨앗 {amount}
            </button>
          ))}
          <button
            type="button"
            onClick={() => feed(pet.seeds)}
            disabled={pending || pet.seeds < 1}
            className="flex-1 rounded-xl py-3 text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: pet.colorHex }}
          >
            전부 넣기
          </button>
        </div>

        <p className="text-xs text-neutral-500">씨앗 1개가 경험치 1이 된다.</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      {evolvedTo ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/95">
          <div className="animate-bounce text-8xl" aria-hidden>
            {emoji}
          </div>
          <p className="text-xl font-semibold">{evolvedTo}단계로 진화했어요</p>
          <p className="text-sm text-neutral-500">{pet.skinName}가 한 단계 자랐습니다</p>
        </div>
      ) : null}
    </main>
  )
}
