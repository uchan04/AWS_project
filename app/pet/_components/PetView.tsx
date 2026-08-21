"use client"

import { useState } from "react"
import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { IDLE_CAP_HOURS, IDLE_SEEDS_PER_HOUR, animalEmoji, expProgress } from "@/lib/pet"
import { SEED_TO_EXP, expToNextLevel } from "@/lib/types"
import "@/styles/tokens.css"
import "../pet.css"

// 소유자: C. 펫 화면 본체. (SPEC.md 5절)
//
// 스타일은 design.md가 정한다. Hallmark · editorial / soft.
// - 종족색은 data-tribe로만 넣는다. style={{ backgroundColor }}를 쓰지 않는다
// - 색 면적은 종족 원판 1개 + 희석된 면 1개까지. 그래서 경험치 바와 CTA는 accent를 쓴다
// - Primary CTA는 화면에 하나뿐이다. 나머지 씨앗 버튼은 ghost다.
//   방치형으로 모인 씨앗이 있으면 그것을 받는 것이 더 앞선 행동이라 "받기"가 primary가 되고
//   "전부 넣기"가 ghost로 내려간다. 어느 상태에서도 primary는 하나다
//
// 이미지 9장이 아직 없어 동물 이모지를 원판 자리에 쓴다. 장식이므로 aria-hidden을 붙이고
// 종족·동물 이름은 옆에 글자로 따로 쓴다.
// imageKey 규칙은 prisma/seed/items.ts에 고정해 뒀으니 이미지가 나오면 <img>로 교체한다.

export type PetState = {
  level: number
  exp: number
  evolutionStage: number
  seeds: number
  /** 방치형으로 모여 있는(아직 안 받은) 씨앗. 배율까지 적용된 값이다 */
  idleSeeds: number
  /** 상한(12시간분)에 닿아 누적이 멈춘 상태인지 */
  idleCapped: boolean
  /** 착용 중인 치장 이름. 이미지가 없어 이름 배지로만 보여준다 */
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
}

export default function PetView({ initial }: { initial: PetState }) {
  const [pet, setPet] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evolvedTo, setEvolvedTo] = useState<number | null>(null)

  const need = expToNextLevel(pet.level)
  const progress = expProgress(pet.level, pet.exp)
  const emoji = animalEmoji(pet.animal)
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
        imageUrl: next.imageUrl ?? prev.imageUrl,
      }))

      // 진화 풀스크린 연출 2초 (SPEC.md 5절)
      if (next.evolvedTo) {
        setEvolvedTo(next.evolvedTo)
        setTimeout(() => setEvolvedTo(null), 2000)
      }

      window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } catch {
      setError("네트워크 연결을 확인해 주세요")
    } finally {
      setPending(false)
    }
  }

  // 방치형 수령. 서버가 지급량을 다시 계산하므로 화면의 숫자를 보내지 않는다 (SPEC.md 5절)
  async function claim() {
    if (pending || pet.idleSeeds < 1) return
    setPending(true)
    setError(null)

    try {
      const res = await fetch("/api/pet/idle", { method: "POST" })
      const json = await res.json()

      if (!res.ok) {
        setError(json?.error?.message ?? "잠시 후 다시 시도해 주세요")
        return
      }

      setPet((prev) => ({ ...prev, seeds: json.data.seeds, idleSeeds: 0, idleCapped: false }))
      window.dispatchEvent(new CustomEvent("user-stats-changed"))
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
            {pet.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pet.imageUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                  if (e.currentTarget.nextSibling) {
                    ;(e.currentTarget.nextSibling as HTMLElement).style.display = "block"
                  }
                }}
              />
            ) : null}
            <span style={{ display: pet.imageUrl ? "none" : "block" }}>{emoji}</span>
          </span>
          <span className="hm-plate__animal">{pet.animal}</span>
          <span className="hm-plate__caption">
            {pet.stageCount > 1 ? `${pet.evolutionStage}단계` : "단일 형태"} · {pet.colorName}
          </span>
          {pet.effectLabel ? <span className="hm-pill">{pet.effectLabel}</span> : null}
          {pet.worn.length > 0 ? (
            <span className="hm-pet__worn">
              {pet.worn.map((name) => (
                <span className="hm-pill" key={name}>
                  {name}
                </span>
              ))}
            </span>
          ) : null}
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

        {pet.idleSeeds > 0 ? (
          <div className="hm-card">
            <div className="hm-status">
              <span className="hm-row__label">모인 씨앗</span>
              <span className="hm__note">{pet.idleSeeds}개</span>
            </div>
            <p className="hm__note">
              {pet.idleCapped
                ? `한 번에 모이는 양(${IDLE_CAP_HOURS}시간분)을 채웠어요. 받아 가면 다시 모여요.`
                : `자리를 비운 동안 모였어요. 시간마다 ${IDLE_SEEDS_PER_HOUR}개씩 쌓여요.`}
            </p>
            <div className="hm-pet__acts">
              <button
                type="button"
                onClick={claim}
                disabled={pending}
                aria-disabled={pending}
                className="hm-btn"
              >
                {pet.idleSeeds}개 받기
              </button>
            </div>
          </div>
        ) : null}

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
              // 받을 씨앗이 남아 있으면 그쪽이 primary다. 화면에 primary는 하나만 둔다
              className={pet.idleSeeds > 0 ? "hm-btn hm-btn--ghost" : "hm-btn"}
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

        {/* design.md의 tertiary(밑줄 링크)다 — primary는 위에 이미 하나 있다 */}
        <Link className="hm-link" href="/pet/cosmetics">
          치장 꾸미기
        </Link>
        <Link className="hm-link" href="/pet/skins">
          캐릭터 바꾸기
        </Link>
      </div>

      {evolvedTo ? (
        <div className="hm-pet__evolve" role="status">
          <span className="hm-plate__disc hm-bounce" aria-hidden="true">
            {pet.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pet.imageUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                  if (e.currentTarget.nextSibling) {
                    ;(e.currentTarget.nextSibling as HTMLElement).style.display = "block"
                  }
                }}
              />
            ) : null}
            <span style={{ display: pet.imageUrl ? "none" : "block" }}>{emoji}</span>
          </span>
          <p className="hm-pet__evolve-title">{evolvedTo}단계로 진화했어요</p>
          <p className="hm__note">{pet.skinName}가 한 단계 자랐습니다</p>
        </div>
      ) : null}
    </main>
  )
}
