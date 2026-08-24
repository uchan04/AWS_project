"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { BREATH_CYCLE_SECONDS, breathAt } from "@/lib/pet"
import { ArtImage } from "@/app/components/ArtImage"
import Bonfire from "./Bonfire"
import "@/styles/tokens.css"
import "../../pet.css"

// 소유자: C. /pet/rest 본체. 서버를 한 번도 부르지 않는다 — 저장할 것이 없다.

/** 호흡 안내를 몇 초 뒤에 접을 것인가. 3분. 그 뒤에도 화면은 그대로 있다 */
const SUGGEST_STOP_SECONDS = 180

export default function RestRoom({
  typeCode,
  imageUrl,
}: {
  typeCode: TypeCode | null
  imageUrl: string | null
}) {
  const tribe = typeCode ? TRIBE[typeCode] : null
  const [elapsed, setElapsed] = useState(0)
  const [rain, setRain] = useState(false)

  // 1초 타이머. 호흡 원은 CSS transition으로 부드럽게 이어지므로 60fps가 필요 없다
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const breath = breathAt(elapsed)
  const cycles = Math.floor(elapsed / BREATH_CYCLE_SECONDS)
  const stayed = elapsed >= SUGGEST_STOP_SECONDS

  return (
    <main className="pet pet-rest" data-tribe={typeCode ?? undefined}>
      <div className="pet-rest__bar">
        {/* 나가는 길을 항상 보이는 자리에 둔다. 전체 화면 연출(원안은 position: fixed로
            화면을 덮었다) 안에서 나갈 방법이 애매하면 그 자체가 불안 요소가 된다 */}
        <Link className="pet-plank" href="/pet">
          ← 펫에게 돌아가기
        </Link>
        <button
          type="button"
          className="pet-plank"
          onClick={() => setRain((on) => !on)}
          aria-pressed={rain}
        >
          {rain ? "🔊 빗소리 끄기" : "🔈 빗소리 켜기"}
        </button>
      </div>

      <RainSound on={rain} />

      <section className="pet-rest__stage">
        <h1 className="pet-rest__title">아무것도 안 하기</h1>
        <p className="pet-rest__lede">
          여기서는 할 일이 없어요. 숨만 쉬어도 되고, 그냥 보고만 있어도 돼요.
        </p>

        {/* 호흡 원. 지름을 phase·progress에서 계산한다 — 들이쉬면 커지고 내쉬면 작아진다.
            CSS 키프레임으로 하지 않는 이유: 문구("천천히 들이쉬어요")와 크기가 같은
            값에서 나와야 어긋나지 않는다. 키프레임은 JS 타이머와 위상이 조용히 밀린다 */}
        <div
          className="pet-rest__breath"
          data-phase={breath.phase}
          style={{ "--breath": String(breathScale(breath)) } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="pet-rest__breath-ring" />
          <span className="pet-rest__breath-count">{breath.remaining}</span>
        </div>

        {/* 문구만 읽어 준다. 원은 aria-hidden이고, 매초 바뀌는 숫자에 live를 걸면
            스크린리더가 초를 계속 읽어 조용히 있으려는 화면이 가장 시끄러워진다 */}
        <p className="pet-rest__breath-label" role="status">
          {breath.label}
        </p>

        <div className="pet-rest__pet">
          {imageUrl ? (
            <ArtImage className="pet-rest__pet-img" src={imageUrl} width={140} height={140} decorative />
          ) : (
            <span className="pet-rest__pet-emoji" aria-hidden="true">
              {tribe?.emoji ?? "🌱"}
            </span>
          )}
          <p className="pet-rest__pet-line">
            {tribe ? `${tribe.animal}도 옆에서 같이 쉬고 있어요` : "옆에서 같이 쉬고 있어요"}
          </p>
        </div>

        <p className="pet-rest__meta">
          {cycles < 1
            ? "호흡 한 번만 따라와도 충분해요"
            : stayed
              ? `${cycles}번 함께 숨 쉬었어요. 여기 더 있어도 되고, 지금 나가도 돼요`
              : `${cycles}번 함께 숨 쉬었어요`}
        </p>
      </section>

      <Bonfire animal={tribe?.animal ?? null} />
    </main>
  )
}

/** 원 지름 배율 0.7~1.15. 들이쉬기엔 커지고, 참는 동안 유지, 내쉬기엔 줄어든다 */
function breathScale(breath: { phase: string; progress: number }): number {
  const MIN = 0.7
  const MAX = 1.15
  if (breath.phase === "in") return MIN + (MAX - MIN) * breath.progress
  if (breath.phase === "hold") return MAX
  return MAX - (MAX - MIN) * breath.progress
}

/**
 * 빗소리. **파일을 받아오지 않고 브라우저가 만든다.**
 *
 * 원안은 `new Audio("https://cdn.freesound.org/previews/…mp3")`였다. 두 가지가 막는다.
 * 1. middleware.ts의 CSP에 `media-src`가 없어 `default-src 'self'`로 떨어진다 →
 *    외부 오디오는 차단된다. 실패는 `.catch(console.error)`가 삼켜서 버튼만 안 먹는다
 * 2. 남의 CDN 파일에 서비스가 의존한다. 링크가 죽으면 조용히 기능이 사라진다
 *
 * 화이트노이즈 버퍼 + 로우패스면 비 소리에 가깝다. 새 의존성도, 새 에셋도, CSP 변경도
 * 필요 없다. AudioContext는 사용자가 버튼을 누른 뒤에만 만든다 —
 * 자동재생 정책상 제스처 전에 만들면 suspended 상태로 시작해 소리가 안 난다.
 */
function RainSound({ on }: { on: boolean }) {
  const ctxRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null)

  useEffect(() => {
    if (!on) {
      const nodes = nodesRef.current
      const ctx = ctxRef.current
      if (nodes && ctx) {
        // 뚝 끊으면 딸깍 소리(클릭 노이즈)가 난다. 0.4초에 걸쳐 줄인다
        nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
        nodes.src.stop(ctx.currentTime + 0.5)
        nodesRef.current = null
      }
      return
    }

    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = ctxRef.current ?? new Ctor()
    ctxRef.current = ctx
    void ctx.resume()

    // 2초 버퍼를 루프한다. 짧으면 주기가 귀에 들리고, 길면 만드는 데 시간이 걸린다
    const seconds = 2
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true

    // 900Hz 위를 깎으면 화이트노이즈의 "치익"이 빠지고 비 소리로 들린다
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 900

    const gain = ctx.createGain()
    gain.gain.value = 0
    // 0.09는 배경음 수준이다. 이보다 크면 안내 문구를 읽는 데 방해가 된다
    gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.8)

    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start()
    nodesRef.current = { src, gain }

    return () => {
      try {
        src.stop()
      } catch {
        // 이미 멈춘 노드에 stop()을 부르면 던진다. 정리 중이라 무시해도 된다
      }
      nodesRef.current = null
    }
  }, [on])

  // 화면을 떠날 때 컨텍스트를 닫는다. 안 닫으면 탭이 계속 오디오 장치를 잡고 있다
  useEffect(() => {
    return () => {
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [])

  return null
}
