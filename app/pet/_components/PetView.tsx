"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import {
  HUNGER_LOW,
  HUNGER_MAX,
  IDLE_CAP_HOURS,
  IDLE_MAX_SEEDS,
  IDLE_SEEDS_PER_HOUR,
  MS_PER_IDLE_SEED,
  animalEmoji,
  applySeeds,
  expProgress,
  hungerLabel,
  levelUpReply,
  petMood,
  petTouchReply,
  seedsToNextStage,
} from "@/lib/pet"
import { EVOLUTION_LEVEL, SEED_TO_EXP, expToNextLevel } from "@/lib/types"
import PetRoom from "./PetRoom"
import { ArtImage } from "@/app/components/ArtImage"
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
  /** 가입일부터 며칠째인가. 가입 당일이 1이다 (lib/pet.ts daysTogether) */
  daysTogether: number
  /** 지금까지 완료한 미션 수(누적). 같은 미션을 다른 날 한 것도 각각 센다 */
  missionsDone: number
  /** 누적 출석일 */
  attendanceTotal: number
}

// 단계 이름·문구. 단계 임계값은 lib/types.ts의 EVOLUTION_LEVEL이 정본이라
// 여기서는 이름만 갖고 구간 문자열은 그 상수로 만든다.
// 2026-08-21: 4단 진화로 바뀌면서 이름을 알·아기·청소년·성체로 확정했다(사용자 결정).
// 이전 3개(아기·청년·전설)는 쓰지 않는다 — "전설"은 사라졌고 최종 단계는 성체다.
const STAGE_NAME = ["알", "아기", "청소년", "성체"]
const STAGE_DESC = [
  "아직 알 속에 있어요",
  "어린 시절을 보내고 있어요",
  "부쩍 자랐어요",
  "다 자란 모습이에요",
]

/** 마지막 단계 번호. STAGE_NAME과 어긋나면 이름이 없는 단계가 생긴다 */
const MAX_STAGE = STAGE_NAME.length

function stageRange(stage: number): string {
  if (stage === 1) return `Lv.1 ~ ${EVOLUTION_LEVEL.STAGE2 - 1}`
  if (stage === 2) return `Lv.${EVOLUTION_LEVEL.STAGE2} ~ ${EVOLUTION_LEVEL.STAGE3 - 1}`
  if (stage === 3) return `Lv.${EVOLUTION_LEVEL.STAGE3} ~ ${EVOLUTION_LEVEL.STAGE4 - 1}`
  return `Lv.${EVOLUTION_LEVEL.STAGE4}+`
}

const FEED_PRESETS = [1, 10, 50, 100]

/** 반응 대사가 화면에 머무는 시간. 이보다 짧으면 읽기 전에 사라진다 */
const REACTION_MS = 3000

/** 먹였을 때의 반응. 진화 여부와 무관하게 항상 뜬다 */
const FEED_REPLY = "맛있어요! 힘이 나요"

const ko = (n: number) => n.toLocaleString("ko-KR")

export default function PetView({ initial }: { initial: PetState }) {
  const [pet, setPet] = useState(initial)
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [evolvedTo, setEvolvedTo] = useState<number | null>(null)
  const [amount, setAmount] = useState(1)
  const [msLeft, setMsLeft] = useState(initial.msToNextSeed)
  // 쓰다듬기·먹이기 반응. 3초 뒤 사라지고 다시 petMood()의 상태 한 줄로 돌아간다.
  // burst는 파티클 span의 key다 — 값이 바뀌면 remount되어 CSS 애니메이션이 처음부터 다시 돈다
  // (같은 요소의 class만 갈면 연속 클릭에서 두 번째부터 애니메이션이 재생되지 않는다)
  const [reaction, setReaction] = useState<{ text: string; eat: boolean } | null>(null)
  const [burst, setBurst] = useState(0)
  const [touches, setTouches] = useState(0)
  // 지금 몇 시인가. **마운트 후에만 읽는다** — 서버는 UTC(Lambda), 브라우저는 KST라
  // 서버 렌더 값과 클라이언트 첫 렌더 값이 9시간 어긋나 hydration 경고가 난다.
  // null인 동안은 시간대 인사 없이 기존 문구가 나온다
  const [hour, setHour] = useState<number | null>(null)
  // 다음 방치형 씨앗이 쌓이는 목표 시각(epoch ms). 0은 "아직 안 심었다"는 뜻이다
  const nextSeedAt = useRef(0)

  const need = expToNextLevel(pet.level)
  const progress = expProgress(pet.level, pet.exp)
  const emoji = animalEmoji(pet.animal)
  // 단일 형태(친밀도 캐릭터)는 단계 크기를 쓰지 않는다. 중간 크기로 고정한다
  const stage = pet.stageCount > 1 ? Math.min(pet.evolutionStage, MAX_STAGE) : 2
  // 다음 진화까지 남은 씨앗. 최종 단계면 null (lib/pet.ts seedsToNextStage)
  const nextStage = seedsToNextStage(pet.level, pet.exp)
  // 펫이 스스로 상태를 말한다. 반응 대사가 있으면 그동안은 그쪽이 이긴다.
  // hour는 마운트 후에만 값이 있고(서버 UTC / 브라우저 KST), 급한 상태가 없을 때만
  // 쓰인다 — 어느 문장이 나오는지는 petMood()가 정한다(lib/pet.ts)
  const mood = petMood(pet, hour)
  // evolutionStageFor가 MAX_STAGE에서 멈추므로 카드도 그 수를 넘기지 않는다
  const stages = Array.from({ length: Math.min(pet.stageCount, MAX_STAGE) }, (_, i) => i + 1)
  const feedable = Math.min(amount, pet.seeds)

  // 시각을 마운트 직후에 한 번, 그 뒤 10분마다 다시 읽는다.
  // setTimeout(0)을 거치는 이유는 두 가지다 — effect 본문에서 곧바로 setState하면
  // 리렌더가 연쇄되고(react-hooks/set-state-in-effect), 화면을 밤 11시 59분에
  // 열어 둔 사람에게 다음 날 아침까지 "하루가 끝났어요"가 남는다
  useEffect(() => {
    const sync = () => setHour(new Date().getHours())
    const first = setTimeout(sync, 0)
    const every = setInterval(sync, 10 * 60 * 1000)
    return () => {
      clearTimeout(first)
      clearInterval(every)
    }
  }, [])

  // 토스트 2.5초 후 사라짐
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // 다음 씨앗까지 남은 시간. 표시 전용이다 — 실제 지급량은 받기를 누를 때 서버가 다시 센다.
  // 상한에 닿아 있으면 더 쌓이지 않으므로 돌리지 않는다.
  //
  // **절대 시각으로 센다.** 전에는 매 tick마다 `left - 1000`으로 깎았다. 브라우저는
  // 배경 탭의 1초 타이머를 분당 1회까지 줄이므로, 탭을 5분 이상 뒤에 두면 30분이
  // 지나도 화면은 30초만 흐른 것으로 셌다 — 돌아와 보면 "다음 씨앗까지 29분"이
  // 그대로 있고 방에 떨어진 씨앗도 늘지 않는다. 새로고침해야 진짜 값이 나왔다.
  // 목표 시각을 ref에 두고 매번 now와 비교하면 탭이 깨어날 때 스스로 따라잡는다.
  //
  // 값을 렌더가 아니라 effect에서 심는 이유: 서버(SSR)에서 Date.now()를 읽으면
  // 하이드레이션 값과 어긋난다. 첫 페인트는 서버가 준 msToNextSeed 그대로 쓴다.
  useEffect(() => {
    if (pet.idleCapped || pet.idleSeeds >= IDLE_MAX_SEEDS) return
    // 0이면 아직 안 심은 것이다. 심기 전에 while을 돌면 무한 루프가 된다
    if (!nextSeedAt.current) nextSeedAt.current = Date.now() + initial.msToNextSeed

    const tick = setInterval(() => {
      const now = Date.now()
      let due = 0
      while (nextSeedAt.current <= now) {
        due += 1
        nextSeedAt.current += MS_PER_IDLE_SEED
      }
      if (due > 0) {
        setPet((prev) => ({
          ...prev,
          idleSeeds: Math.min(IDLE_MAX_SEEDS, prev.idleSeeds + due),
        }))
      }
      // 화면은 분 단위로만 쓴다. 분이 그대로면 같은 값을 돌려줘 리렌더를 건너뛴다 —
      // 1초마다 이 컴포넌트 전체를 다시 그릴 이유가 없다(React가 동일 값이면 멈춘다)
      const left = Math.max(0, nextSeedAt.current - now)
      setMsLeft((prev) =>
        Math.ceil(left / 60_000) === Math.ceil(prev / 60_000) ? prev : left,
      )
    }, 1000)
    return () => clearInterval(tick)
  }, [pet.idleCapped, pet.idleSeeds, initial.msToNextSeed])

  // 반응 대사 정리. burst에 걸어야 3초 안에 다시 누른 경우 타이머가 새로 시작한다
  useEffect(() => {
    if (!reaction) return
    const t = setTimeout(() => setReaction(null), REACTION_MS)
    return () => clearTimeout(t)
  }, [reaction, burst])

  function react(text: string, eat = false) {
    setReaction({ text, eat })
    setBurst((n) => n + 1)
  }

  /**
   * 쓰다듬기. 재화도 저장값도 움직이지 않는다 — 서버를 부르지 않는 순수 상호작용이다.
   * 벤치마크(My Talking Tom·다마고치)에서 펫을 만지는 것은 이 장르의 기본 동작이고,
   * 우리 화면은 그동안 펫을 눌러도 아무 일이 없었다.
   */
  function pat() {
    react(petTouchReply(touches))
    setTouches((n) => n + 1)
  }

  async function feed(seeds: number) {
    if (pending || seeds < 1 || seeds > pet.seeds) return
    setPending(true)

    // 낙관적 갱신. Bedrock이 아니라 RDS(us-east-1) 왕복이라 400~900ms인데, 그동안
    // 게이지가 멈춰 있으면 버튼이 안 눌린 것처럼 읽힌다.
    //
    // 예측값을 손으로 계산하지 않고 서버가 쓰는 것과 **같은** applySeeds()를 부른다.
    // 레벨이 한 번에 여러 개 오르는 경우(씨앗 100개)를 근사식으로 처리하면 화면이
    // 잠깐 틀린 레벨·단계를 보여 주고 응답이 오면서 되돌아가 깜빡인다.
    // 배고픔은 서버가 lastFedAt을 now로 밀므로 100이 된다(lib/pet.ts hungerFor).
    const before = pet
    const guess = applySeeds(
      { level: pet.level, exp: pet.exp, evolutionStage: pet.evolutionStage },
      seeds,
      pet.stageCount,
    )
    setPet((prev) => ({
      ...prev,
      level: guess.level,
      exp: guess.exp,
      evolutionStage: guess.evolutionStage,
      // 씨앗 차감만 예측한다. 스킨 배율(effectPct)은 획득에만 붙고 소모에는 붙지 않는다
      seeds: Math.max(0, prev.seeds - seeds),
      hunger: HUNGER_MAX,
    }))

    try {
      const res = await fetch("/api/pet/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seeds }),
      })
      const json = await res.json()

      if (!res.ok) {
        // 예측을 되돌린다. 씨앗이 줄어든 화면을 남기면 실제로는 있는 씨앗을
        // 못 쓰는 상태가 되고, 새로고침 전까지 사용자가 그걸 알 방법이 없다
        setPet(before)
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
      // 진화하지 않는 대부분의 먹이기에도 반응을 남긴다. 지금까지는 숫자만 바뀌었다.
      //
      // 레벨이 올랐으면 그걸 말하고, 아니면 기본 대사다 (lib/pet.ts levelUpReply)
      react(levelUpReply(next.gainedLevels ?? 0, next.level) ?? FEED_REPLY, true)

      // 진화 풀스크린 연출 2초 (SPEC.md 5절)
      if (next.evolvedTo) {
        setEvolvedTo(next.evolvedTo)
        setTimeout(() => setEvolvedTo(null), 2000)
      }

      window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } catch {
      setPet(before)
      setToast({ text: "네트워크 연결을 확인해 주세요", error: true })
    } finally {
      setPending(false)
    }
  }

  // 방치형 수령. 서버가 지급량을 다시 계산하므로 화면의 숫자를 보내지 않는다 (SPEC.md 5절)
  async function claim() {
    if (pending || pet.idleSeeds < 1) return
    setPending(true)

    // 방에 떨어진 씨앗을 눌렀을 때 바로 사라져야 한다 — 이건 "주웠다"는 동작이라
    // 응답을 기다리는 동안 씨앗이 그대로 남아 있으면 두 번 누르게 된다.
    // 실제 지급량은 서버가 다시 계산하므로(스킨 배율 포함) 보유량은 예측하지 않는다.
    const before = pet
    setPet((prev) => ({ ...prev, idleSeeds: 0, idleCapped: false }))

    try {
      const res = await fetch("/api/pet/idle", { method: "POST" })
      const json = await res.json()

      if (!res.ok) {
        setPet(before)
        setToast({ text: json?.error?.message ?? "잠시 후 다시 시도해 주세요", error: true })
        return
      }

      const gained = json.data.seeds - before.seeds
      setPet((prev) => ({ ...prev, seeds: json.data.seeds, idleSeeds: 0, idleCapped: false }))
      setMsLeft(MS_PER_IDLE_SEED)
      setToast({ text: `씨앗 ${ko(Math.max(0, gained))}개를 수확했어요` })
      // develop이 넣은 줄이다. 수령으로 씨앗이 늘면 상단 재화 HUD를 갱신해야 한다.
      // 2026-08-21 머지: develop이 이벤트 이름을 user-stats-changed로 바꿨다(35746be)
      window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } catch {
      setPet(before)
      setToast({ text: "네트워크 연결을 확인해 주세요", error: true })
    } finally {
      setPending(false)
    }
  }

  const petFace = (
    <>
      {pet.imageUrl ? (
         
        // .pet-char__img가 단계별로 5.5~10rem(88~160px)을 정한다. 가장 큰 칸을 기준으로 넘긴다
        <ArtImage
          className="pet-char__img"
          src={pet.imageUrl}
          width={160}
          height={160}
          fallbackDisplay="block"
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
          {/* 여기로 들어가는 유일한 입구다. 홈이나 미션에서 링크하지 않는다 —
              쉬는 화면을 다른 화면이 권하면 "쉬어라"는 지시가 된다 */}
          <Link className="pet-plank" href="/pet/rest">
            잠깐 쉬기
          </Link>
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

            {/* 방에 떨어진 씨앗을 직접 주워 수확한다. ねこあつめ(고양이 모으기)처럼
                방치형 보상은 방 안의 물건을 눌러 받는 것이 이 장르의 기본 동작이다.
                아래 "받기" 버튼과 같은 claim()을 부른다 — 이건 대체가 아니라 추가다.
                카드 쪽 버튼을 지우면 방 그림을 볼 수 없는 사용자가 수확을 못 한다 */}
            {pet.idleSeeds > 0 ? (
              <button
                type="button"
                className="pet-room__pickup"
                onClick={claim}
                disabled={pending}
                aria-label={`방에 떨어진 씨앗 ${ko(pet.idleSeeds)}개 줍기`}
              >
                <span className="pet-room__pickup-icon" aria-hidden="true">
                  🌱
                </span>
                <span className="pet-room__pickup-text" aria-hidden="true">
                  씨앗 {ko(pet.idleSeeds)}개 줍기
                </span>
              </button>
            ) : null}

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

              {/* 눌러서 쓰다듬는다. span이던 것을 button으로 감쌌다 —
                  키보드로도 닿아야 하고, 그림 자체는 aria-hidden이라 라벨을 여기 붙인다 */}
              <button
                type="button"
                className="pet-char__touch"
                onClick={pat}
                aria-label={`${pet.skinName} 쓰다듬기`}
              >
                <span className="pet-char__body" aria-hidden="true">
                  {petFace}
                </span>
              </button>

              {/* 반응 파티클. key가 바뀌면 remount되어 애니메이션이 처음부터 다시 돈다 */}
              {reaction ? (
                <span className="pet-char__burst" key={burst} aria-hidden="true">
                  <span data-i="1">{reaction.eat ? "🌱" : "💗"}</span>
                  <span data-i="2">{reaction.eat ? "✨" : "💗"}</span>
                  <span data-i="3">{reaction.eat ? "🌿" : "💗"}</span>
                </span>
              ) : null}

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

            {/* 펫이 스스로 말한다. aria-live를 걸지 않는다 — 같은 내용을 배고픔·경험치
                게이지와 토스트가 이미 알리고, 여기에 live를 걸면 먹일 때마다
                "맛있어요"와 토스트가 겹쳐 읽힌다.

                .pet-char 안이 아니라 방 직속이고, DOM에서 .pet-char **뒤**에 둔다.
                - 펫 위쪽 바깥(bottom: 100%)에 붙였더니 320px에서 방을 73px 넘어가
                  overflow: hidden에 잘렸다(실측). 그래서 방 위쪽 고정으로 바꿨다.
                - z-index가 같으면 DOM 순서가 위아래를 정한다. 앞에 두면 좁은 화면에서
                  펫 머리가 글자를 덮는다 — 읽히는 쪽이 위여야 한다 */}
            <p className="pet-bubble" data-tone={reaction ? (reaction.eat ? "eat" : "touch") : mood.tone}>
              {reaction?.text ?? mood.text}
            </p>
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
            {/* 지금까지 `Lv.25 마지막 진화`만 보여 줬다. 그 문구는 지금 무엇을 얼마나
                해야 하는지 알려 주지 않는다. 벤치마크한 육성 게임은 전부 남은 개수를 쓴다 */}
            <p className="pet-card__foot">
              <span>현재 Lv.{pet.level}</span>
              <span>
                {nextStage
                  ? `${STAGE_NAME[nextStage.stage - 1] ?? `${nextStage.stage}단계`}까지 씨앗 ${ko(nextStage.seeds)}개`
                  : "마지막 단계예요"}
              </span>
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

            {/* 씨앗이 0개면 조작부를 전부 비활성으로 두지 않는다. 전에는 스테퍼·프리셋
                5개·먹이기 버튼이 모두 회색으로 남아 **어디서 씨앗을 얻는지는 아무데도
                적혀 있지 않았다** — 처음 온 사람이 가장 자주 만나는 상태다.
                고장난 화면 대신 다음 행동(미션) 하나만 보여 준다 */}
            {pet.seeds < 1 ? (
              <div className="pet-empty">
                <p className="pet-empty__text">
                  씨앗이 없어요. 미션을 하나 해내면 씨앗이 생겨요
                </p>
                <Link className="pet-btn pet-btn--block" href="/missions">
                  오늘의 미션 보기
                </Link>
                <p className="pet-empty__hint">
                  방치형으로도 시간당 {IDLE_SEEDS_PER_HOUR}개씩 모여요
                </p>
              </div>
            ) : (
              <>
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
                    실제 경제(일일 미션 60/일)에 맞춰 1·10·50·100으로 잡았다.
                    "전부"를 뒤에 붙였다 — 3,000개를 모은 사람이 100개 프리셋을 서른 번
                    누르는 것 말고는 방법이 없었다. 벤치마크 5종 모두 MAX 버튼이 있다 */}
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
                  <button
                    type="button"
                    className="pet-preset"
                    aria-pressed={amount === pet.seeds}
                    onClick={() => setAmount(pet.seeds)}
                    aria-label={`보유한 씨앗 ${ko(pet.seeds)}개 전부`}
                  >
                    전부
                  </button>
                </div>

                <button
                  type="button"
                  className="pet-btn pet-btn--block"
                  onClick={() => feed(feedable)}
                  disabled={pending || amount > pet.seeds}
                  aria-disabled={pending || amount > pet.seeds}
                >
                  씨앗 {ko(amount)}개 먹이기 🌱
                </button>

                {/* 투입할 개수가 정해지면 그것이 무엇이 되는지 바로 옆에서 말한다.
                    "씨앗 1개는 경험치 10"만으로는 100개를 넣기 전에 곱셈을 시켜야 했다 */}
                <p className="pet-card__foot">
                  <span>씨앗 1개는 경험치 {SEED_TO_EXP}이 돼요</span>
                  <em>경험치 +{ko(feedable * SEED_TO_EXP)}</em>
                </p>
              </>
            )}
          </div>

          {/* 함께한 기록. 벤치마크 5종은 전부 누적된 것을 보여 준다(다마고치 나이,
              Finch 여정, ねこあつめ 수집, 포켓캠프 앨범). 우리 화면에는 "지금 상태"만
              있어서 6주째 매일 온 사람과 오늘 처음 온 사람의 화면이 레벨 말고는 같았다.
              남과 비교하는 랭킹은 여전히 넣지 않는다(SPEC.md 5절) — 비교 대상은 과거의 자신뿐이다 */}
          <div className="pet-card">
            <div className="pet-card__head">
              <p className="pet-card__title">📖 함께한 기록</p>
            </div>
            <dl className="pet-log">
              <div className="pet-log__item">
                <dt className="pet-log__label">함께한 날</dt>
                <dd className="pet-log__value">{ko(pet.daysTogether)}일</dd>
              </div>
              <div className="pet-log__item">
                <dt className="pet-log__label">해낸 미션</dt>
                <dd className="pet-log__value">{ko(pet.missionsDone)}개</dd>
              </div>
              <div className="pet-log__item">
                <dt className="pet-log__label">출석</dt>
                <dd className="pet-log__value">{ko(pet.attendanceTotal)}일</dd>
              </div>
            </dl>
            <p className="pet-card__foot">
              <span>
                {pet.missionsDone > 0
                  ? `여기까지 오는 데 ${ko(pet.daysTogether)}일이 걸렸어요`
                  : "첫 미션을 해내면 여기에 남아요"}
              </span>
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
                   
                  <ArtImage className="pet-evo-card__img" src={img} width={64} height={64} decorative />
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
        <div className="pet-evolve" role="status">
          <span className="pet-char__body" aria-hidden="true">
            {petFace}
          </span>
          <p className="pet-evolve__title">{evolvedTo}단계로 진화했어요</p>
          <p className="pet-card__meta">{pet.skinName}가 한 단계 자랐습니다</p>
        </div>
      ) : null}
    </main>
  )
}
