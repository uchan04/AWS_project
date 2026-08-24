"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import {
  IDLE_MAX_SEEDS,
  MS_PER_IDLE_SEED,
  PET_IDLE_LINES,
  animalEmoji,
  expProgress,
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
// - 2026-08-21 사용자 결정: 배고픔 게이지를 걷고 그 자리에 재화 3종(씨앗·별조각·친밀도)과
//   상점 입구 2개를 넣었다. 상단 바에 있던 씨앗 HUD와 나무판 2개가 여기로 내려온 것이다.
//   상단은 제목만 남는다 — 재화와 상점 입구가 두 곳에 겹쳐 있을 이유가 없다
// - 방 배경: 착용한 배경 치장이 있으면 그 그림, 없으면 PetRoom의 기본 방 SVG다
//   (2026-08-21 사용자 확정). 펫은 배경과 무관하게 방 중앙 하단에 고정한다

export type PetState = {
  level: number
  exp: number
  evolutionStage: number
  seeds: number
  /** 별조각. 외형 상점의 값이다 */
  starShards: number
  /** 친밀도. 배경 상점의 값이다 */
  affinity: number
  /** 오늘 들어온 재화. 지갑에 잔액만 있으면 이 재화가 어디서 왔는지가 화면에서 끊긴다 */
  today: { seeds: number; starShards: number; affinity: number }
  /**
   * 누적 출석일(User.attendanceTotal). "오늘의 활동" 카드의 네 번째 칸이 쓴다
   * (2026-08-24 사용자 요청). today 안에 넣지 않은 이유는 오늘 값이 아니기 때문이다 —
   * 오늘 하루의 증감을 모아 둔 today에 누계를 섞으면 다음 사람이 today.seeds도
   * 누계로 읽는다
   */
  attendanceDays: number
  /** 방치형으로 모여 있는(아직 안 받은) 씨앗. 배율까지 적용된 값이다 */
  idleSeeds: number
  /** 상한(12시간분)에 닿아 누적이 멈춘 상태인지 */
  idleCapped: boolean
  /** 다음 1개가 쌓이기까지 남은 밀리초. 상단 카운트다운에 쓴다 */
  msToNextSeed: number
  /**
   * 방에 들어왔을 때 뜨는 인사. 방문 간격과 무관하게 늘 온다(2026-08-23 사용자 결정).
   * 문장은 서버(`lib/pet.ts` `greetingFor()`)가 고른다 — 하이드레이션 때문에 여기서 못 고른다
   */
  welcome: string
  /**
   * 평상시 대사(`PET_IDLE_LINES`)를 몇 번째부터 돌릴지. 서버가 유저·날짜로 정한다.
   * 0으로 고정하면 모든 유저가 늘 같은 순서로 같은 문장을 본다
   */
  idleLineStart: number
  /** 착용 중인 치장 이름 배지 */
  worn: string[]
  animal: string
  // family·colorName은 없다. 방의 상태 문구("여우과 · 흰색")가 유일한 사용처였고
  // 2026-08-21 그 문구를 걷으면서 함께 지웠다. 종족 표시가 다시 필요하면
  // page.tsx의 TRIBE[typeCode]에서 그때 다시 내려보낸다
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

// 단계 이름. 단계 임계값은 lib/types.ts의 EVOLUTION_LEVEL이 정본이라
// 여기서는 이름만 갖고 구간 문자열은 그 상수로 만든다.
// 2026-08-21: 4단 진화로 바뀌면서 이름을 알·아기·청소년·성체로 확정했다(사용자 결정).
// 이전 3개(아기·청년·전설)는 쓰지 않는다 — "전설"은 사라졌고 최종 단계는 성체다.
// 같은 날 방의 상태 문구를 걷으면서 STAGE_DESC("다 자란 모습이에요" 등 4개)도 지웠다.
// 단계를 글자로 알리는 곳은 이제 진화 단계 카드의 STAGE_NAME 하나다.
const STAGE_NAME = ["알", "아기", "청소년", "성체"]

/** 마지막 단계 번호. STAGE_NAME과 어긋나면 이름이 없는 단계가 생긴다 */
const MAX_STAGE = STAGE_NAME.length

function stageRange(stage: number): string {
  if (stage === 1) return `Lv.1 ~ ${EVOLUTION_LEVEL.STAGE2 - 1}`
  if (stage === 2) return `Lv.${EVOLUTION_LEVEL.STAGE2} ~ ${EVOLUTION_LEVEL.STAGE3 - 1}`
  if (stage === 3) return `Lv.${EVOLUTION_LEVEL.STAGE3} ~ ${EVOLUTION_LEVEL.STAGE4 - 1}`
  return `Lv.${EVOLUTION_LEVEL.STAGE4}+`
}

/** 다음 진화까지 남은 것. 최종 단계면 null */
function nextMilestone(level: number): string | null {
  if (level < EVOLUTION_LEVEL.STAGE2) return `Lv.${EVOLUTION_LEVEL.STAGE2} 첫 진화`
  if (level < EVOLUTION_LEVEL.STAGE3) return `Lv.${EVOLUTION_LEVEL.STAGE3} 다음 진화`
  if (level < EVOLUTION_LEVEL.STAGE4) return `Lv.${EVOLUTION_LEVEL.STAGE4} 마지막 진화`
  return null
}

// 2026-08-22 사용자 결정: 100을 빼고 5를 넣었다. 100개를 한 번에 넣는 일이 거의 없다.
// 누적 더하기로 바뀐 뒤로는 50을 두 번 눌러 100을 만들 수 있어 잃는 것도 없다
const FEED_PRESETS = [1, 5, 10, 50]

/**
 * 개수 버튼을 눌렀을 때 나올 값. 비활성 판정과 클릭이 **같은 식을 써야** 한다 —
 * 식이 갈리면 눌리는데 값이 안 바뀌거나(죽은 버튼), 막아야 할 때 눌린다.
 *
 * 최소값(1)에서 2 이상을 누르면 더하지 않고 그 값이 된다. 1 + 10 = 11이면 "10개"를
 * 눌렀는데 11이 돼 버튼 이름과 어긋난다. `preset > 1` 조건이 붙은 이유는 1개 버튼이다 —
 * 이 조건이 없으면 1에서 "1개"를 눌러도 1이라 아무 일도 안 일어난다.
 */
const feedStep = (current: number, preset: number) =>
  current <= 1 && preset > 1 ? preset : current + preset

const ko = (n: number) => n.toLocaleString("ko-KR")

/**
 * 평상시 대사가 다음 문장으로 넘어가는 간격 (2026-08-23).
 * 길게 잡은 값이다 — 이유는 아래 순환 useEffect 주석에 있다.
 *
 * 2026-08-24 사용자 요청("계속 바꾸지 말고 5분 정도 주기로")으로 20초 → 5분.
 */
const IDLE_LINE_MS = 5 * 60_000

export default function PetView({ initial }: { initial: PetState }) {
  const [pet, setPet] = useState(initial)
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [evolvedTo, setEvolvedTo] = useState<number | null>(null)
  const [amount, setAmount] = useState(1)
  // 마지막으로 누른 개수 버튼. 개수 버튼이 "고르기"에서 "더하기"로 바뀌면서(2026-08-22)
  // amount === p로는 어느 버튼을 눌렀는지 알 수 없게 됐다 — 10을 세 번 누르면 30이고
  // 그 값과 같은 버튼이 없다. 알약 하나가 차 있는 시안의 모양을 지키려고 따로 담는다
  const [lastPreset, setLastPreset] = useState<number | null>(null)
  const [msLeft, setMsLeft] = useState(initial.msToNextSeed)
  // 말풍선. 닫으면 이 화면에 있는 동안 다시 뜨지 않는다
  const [bubbleClosed, setBubbleClosed] = useState(false)
  // 평상시 대사 순환 위치. null이면 아직 접속 인사를 보여 주는 중이다.
  // 시작 위치는 서버가 정한다 — 여기서 고르면 하이드레이션에서 어긋난다
  const [lineAt, setLineAt] = useState<number | null>(null)

  // 말풍선에 지금 들어갈 문장. 닫혔으면 null, 순환 전이면 접속 인사, 그다음은 평상시 대사다
  const bubble = bubbleClosed ? null : lineAt === null ? pet.welcome : PET_IDLE_LINES[lineAt]

  const need = expToNextLevel(pet.level)
  const progress = expProgress(pet.level, pet.exp)
  const emoji = animalEmoji(pet.animal)
  // 단일 형태(친밀도 캐릭터)는 단계 크기를 쓰지 않는다. 중간 크기로 고정한다
  const stage = pet.stageCount > 1 ? Math.min(pet.evolutionStage, MAX_STAGE) : 2
  const milestone = nextMilestone(pet.level)
  // evolutionStageFor가 MAX_STAGE에서 멈추므로 카드도 그 수를 넘기지 않는다
  const stages = Array.from({ length: Math.min(pet.stageCount, MAX_STAGE) }, (_, i) => i + 1)
  const feedable = Math.min(amount, pet.seeds)

  // 재화 3종. 2026-08-21 사용자 결정으로 셋이 같은 칸을 쓴다 — 전에는 씨앗만 초록, 나머지
  // 둘은 나무색이었다. 색은 종족색 하나로 끝내고 구분은 이모지가 한다
  const wallet = [
    { name: "씨앗", icon: "🌱", value: pet.seeds },
    { name: "별조각", icon: "⭐", value: pet.starShards },
    { name: "친밀도", icon: "💛", value: pet.affinity },
  ]

  // 여기서 오늘 들어온 재화의 출처 문장(sourceLines)을 만들었다 — "오늘 미션으로 씨앗 +45",
  // "오늘 대화·커뮤니티로 친밀도 +N" 두 줄이 지갑 카드 아래에 붙었다.
  // **2026-08-24 사용자 요청으로 지웠다**("보유 재화 칸 밑에 오늘 미션으로 씨앗 얼마나 얻었는지
  // 알려주는 문구 지워주고 그 빈 여백에 …상점을 세로로 더 두껍게").
  //
  // 지워도 정보가 사라지지 않는 이유: 같은 날 만든 오른쪽 열 "오늘의 활동" 4칸이 같은
  // pet.today를 쓴다(아래 todayTiles). 문장과 칸이 같은 값을 두 번 말하고 있었고, 요청은
  // 그중 문장 쪽을 걷어 그 높이를 상점 입구 두 개에 준 것이다.
  // 출처("미션에서 왔다"·"대화에서 왔다")는 문장에만 있던 것이라 이 삭제로 함께 없어진다 —
  // 되살릴 일이 생기면 pet.css의 .pet-wallet__source 주석과 docs/dev/pet.md에 규칙이 남아 있다.
  //
  // 오늘의 활동 3칸 (2026-08-24 사용자 요청, 시안 이미지 한 장).
  //
  // 값은 지운 그 문장과 **같은 pet.today**다 — 새로 받아 오는 것이 없고 API도 안 늘었다.
  // 시안의 세 칸은 "먹인 씨앗 / 획득 EXP / 친밀도"였는데 앞의 둘을 그대로 만들 수 없었다:
  // POST /api/pet/feed는 씨앗을 차감하고 level·exp만 갱신하고 **오늘 먹인 양을 남기지 않는다**
  // (lastFedAt에 마지막 시각만 있고 읽는 곳도 없다). 누적 exp는 있지만 "오늘 오른 exp"는
  // 복원이 안 된다. 정확히 세려면 User에 컬럼 2개가 필요한데 schema.prisma는 5인 공유
  // 파일이라(CLAUDE.md 1·5절) 여기서 못 건드린다. 그래서 사용자 결정으로 **이미 있는
  // 오늘 값 3종**을 넣었다 — 칸 모양과 배치는 시안 그대로다.
  // 컬럼이 생기면 이 배열만 갈아 끼우면 된다.
  //
  // **2026-08-24: 3칸 → 4칸, 그리고 값이 0이어도 칸을 그린다.**
  // 사용자 요청이 "오늘의 활동 칸에 오늘 받은 별조각칸, 출석일수 칸도 안에 따로 만들어줘"다.
  // 별조각 칸은 이미 배열에 있었지만 화면에 안 나왔다 — 일일 미션의 rewardShards가 전부 0이고
  // (별조각은 3단 단계 미션 5개와 일일 전체 완료 보너스에서만 나온다) 그날 그 미션을 깨지
  // 않은 사람은 값이 0이라 아래 filter가 칸을 빼 버렸다. 그래서 filter를 걷었다.
  //
  // 그 filter의 근거는 "+0은 성취가 아니라 미달 표시로 읽힌다"였고(이 서비스는 못 한 것을
  // 화면에 세지 않는다 — 랭킹 배제·배고픔 게이지 삭제와 같은 이유. SPEC.md 5절),
  // 그 근거는 **문장 형태에만** 해당한다. "오늘 미션으로 별조각 +0"은 없는 성과를 서술하지만,
  // 칸은 자리이고 그 자리가 항상 있으면 "여기에 별조각이 들어온다"는 안내로 읽힌다 — 요청이
  // 칸을 만들어 달라는 것이었으므로 이 카드에서는 그쪽을 택했다.
  // (그 문장 자체는 같은 날 사용자 요청으로 지갑 카드에서 걷혔다. 위 주석 참고)
  // 부수 효과로 카드 높이가 하루 종일 고정되고
  // (칸 수가 안 변한다) 오른쪽 열 바닥 맞춤(pet.css .pet__col--side)이 흔들리지 않는다.
  //
  // 출석일수는 누계(User.attendanceTotal)다. 연속(streakCount)이 아니다 — 요청한 이름이
  // "출석일수"이고, 연속을 세면 하루 빠진 사람의 칸이 1로 떨어져 이 서비스가 안 하는
  // 벌점 표시가 된다(SPEC.md 5절 랭킹·경쟁 배제와 같은 이유). 연속으로 바꿀 일이 생기면
  // page.tsx의 attendanceDays 한 줄만 갈면 된다.
  //
  // text를 미리 만드는 이유: 재화 셋은 "+N"이고 출석은 "N일"이라 접두사·단위가 다르다.
  // 렌더에서 분기하면 칸마다 다른 서식이 JSX에 흩어진다.
  const todayTiles = [
    { name: "받은 씨앗", icon: "🌱", text: `+${ko(pet.today.seeds)}`, seed: true },
    { name: "받은 별조각", icon: "⭐", text: `+${ko(pet.today.starShards)}`, seed: false },
    { name: "받은 친밀도", icon: "💛", text: `+${ko(pet.today.affinity)}`, seed: false },
    { name: "출석일수", icon: "📅", text: `${ko(pet.attendanceDays)}일`, seed: false },
  ]

  // 토스트 2.5초 후 사라짐
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // 평상시 대사 순환 (2026-08-23). 접속 인사를 띄운 뒤 이 간격마다 다음 문장으로 바뀐다.
  //
  // 5분은 짧게 잡지 않은 값이다. 문장이 빨리 넘어가면 읽는 것이 과제가 되고, 이 화면은
  // 소진 85%인 사람이 아무것도 안 하러 오는 곳이다. 읽다 말아도 다음에 또 돌아온다.
  //
  // 2026-08-24: 20초에서 올렸다(사용자 요청 "계속 바꾸지 말고"). 이 간격에서는 한 번
  // 들어와 몇 분 머무는 동안 대사가 한두 번만 바뀐다 — 대사가 눈에 띄는 움직임이 아니라
  // 방에 붙어 있는 한 줄이 된다. 평상시 10문장을 한 바퀴 도는 데 50분이라 순환은 사실상
  // 안 보이고, 대신 시작 위치를 서버가 매번 다시 고르므로 방문마다 다른 문장을 만난다.
  // 닫아 둔 동안에는 돌리지 않는다 — 닫은 것을 타이머가 되살리면 닫기가 의미를 잃는다
  useEffect(() => {
    if (bubbleClosed) return
    const tick = setInterval(() => {
      // null(인사 중)이면 서버가 준 시작 위치로 들어가고, 그다음은 한 칸씩 돈다
      setLineAt((prev) =>
        prev === null ? initial.idleLineStart : (prev + 1) % PET_IDLE_LINES.length,
      )
    }, IDLE_LINE_MS)
    return () => clearInterval(tick)
  }, [bubbleClosed, initial.idleLineStart])

  // 다음 씨앗까지 남은 시간. 2026-08-21부터 화면에 띄우지 않고, 쌓인 개수를 1씩 올리는
  // 타이머로만 쓴다 — 실제 지급량은 받기를 누를 때 서버가 다시 센다.
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
        imageUrl: next.imageUrl ?? prev.imageUrl,
      }))
      setAmount(1)
      setLastPreset(null)
      setToast({ text: `씨앗 ${ko(seeds)}개를 먹였어요. 경험치 +${ko(seeds * SEED_TO_EXP)}` })

      // 진화 풀스크린 연출 2초 (SPEC.md 5절)
      if (next.evolvedTo) {
        setEvolvedTo(next.evolvedTo)
        setTimeout(() => setEvolvedTo(null), 2000)
      }

      window.dispatchEvent(new CustomEvent("user-stats-changed"))
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
      // develop이 넣은 줄이다. 수령으로 씨앗이 늘면 상단 재화 HUD를 갱신해야 한다.
      // 2026-08-21 머지: develop이 이벤트 이름을 user-stats-changed로 바꿨다(35746be)
      window.dispatchEvent(new CustomEvent("user-stats-changed"))
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
      {/* 재화와 상점 입구는 아래 지갑 카드가 갖는다. 상단은 제목만 남긴다 */}
      <header className="pet__top">
        <div>
          <h1 className="pet__title">나의 펫</h1>
          <p className="pet__lede">씨앗을 먹이고 함께 성장하세요</p>
        </div>
      </header>

      <div className="pet__grid">
        <div className="pet__col pet__col--room">
          <div className="pet-room">
            <PetRoom imageUrl={pet.roomImageUrl} />

            {/* 여기 떠다니는 씨앗 장식 3개(🌱🌿🍃)가 있었다 — 2026-08-24 사용자 요청
                ("주위에 둥둥 떠다니는 이모티콘들 지워줘")으로 걷었다. 펫 주위의 반짝임
                3개(✨⭐✨)도 같은 요청으로 함께 걷었다(아래 .pet-char 주석).
                CSS(.pet-room__seeds·.pet-room__seed)와 petFloatSeed 키프레임도 함께 지웠다.
                방을 채우는 것은 배경 그림과 펫뿐이다 */}

            {/* 펫 대사 (2026-08-23 사용자 요청). 20문장 전부 사용자가 직접 쓴 것이다.
                들어오면 접속 인사(서버가 고른다), 5분마다 평상시 대사로 넘어간다.
                문장 목록과 규칙은 lib/pet.ts "펫 대사" 절에 있다.

                말풍선을 캐릭터 **위**에 두고 꼬리를 아래로 내려 펫이 말하는 것으로 읽히게
                한다. 방이 min-height 27rem이고 .pet-char는 bottom: 0이라 위쪽이 비어 있다.

                aria-live를 걸지 않았다. 주기마다 스크린리더가 대사를 읽으면 화면을 쓰는
                내내 말이 끼어든다 — 이건 알림이 아니라 방 안의 혼잣말이라 그 자리에 있는
                글자로 충분하다. 대신 문장이 바뀔 때 DOM에 그대로 남으므로 훑어 읽을 수 있다 */}
            {bubble ? (
              <div className="pet-welcome">
                {/* 말풍선 모양은 사용자가 준 그림(손그림 blob + 갈고리 꼬리)을 그대로 옮긴
                    path 하나다. border-radius로는 이 모양이 안 나온다 — 굴곡이 네 군데
                    다르고 꼬리가 박스 밖으로 나가는데, border-radius는 각 모서리에 타원
                    하나씩만 줄 수 있고 가상 요소 꼬리는 언제나 직선 두 변이다.

                    본체가 상자를 꽉 채우고(viewBox 208×104 = .pet-welcome의 13rem×6.5rem)
                    꼬리는 viewBox **아래로 넘겨** 그렸다(y가 104를 넘는다). 그래서 꼬리가
                    글자 자리를 먹지 않고, CSS가 overflow: visible로 그 부분을 살린다.

                    preserveAspectRatio="none": 세 줄짜리 문장에서 상자가 조금 높아지면
                    본체도 같이 늘어나야 아래 테두리가 글자에 닿지 않는다. 늘어나도 선
                    굵기는 vector-effect로 3px에 고정된다 — 이게 없으면 늘어난 방향의 선만
                    두꺼워져 손그림 느낌이 깨진다.
                    상자 크기 13rem×6.5rem·12rem×6rem 둘 다 정확히 2:1이라 평소에는
                    늘어남이 0이다(pet.css .pet-welcome 주석) */}
                <svg
                  className="pet-welcome__shape"
                  viewBox="0 0 208 104"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    vectorEffect="non-scaling-stroke"
                    d="M62 6C100 2 150 4 178 14C197 21 205 38 202 57C199 78 176 91 146 94C136 95 126 95 116 95C118 103 112 113 92 118C98 111 97 102 94 95C74 95 40 93 22 84C8 76 2 58 6 40C11 22 32 9 62 6Z"
                  />
                </svg>
                <p className="pet-welcome__text">{bubble}</p>
                <button
                  type="button"
                  className="pet-welcome__close"
                  onClick={() => setBubbleClosed(true)}
                  aria-label="펫 말풍선 닫기"
                >
                  ✕
                </button>
              </div>
            ) : null}

            {/* 2026-08-23 사용자 요청으로 머리 위 Lv. 배지를 걷었다. 말풍선을 캐릭터 바로
                위에 붙이려면 배지가 그 자리를 쓰고 있었다 — 방을 27rem으로 키운 뒤에도
                좁은 화면에서는 말풍선과 배지가 겹쳤다(위 .pet-welcome 주석의 계산).
                레벨은 아래 진화 카드의 "현재 Lv.N"에 그대로 있으므로 정보가 사라지지 않는다.
                배지 CSS(.pet-char__badge)와 petBounceBadge 키프레임도 함께 걷었다 */}
            {/* 펫 주위를 돌던 반짝임 3개(✨⭐✨, data-i로 위치·타이밍이 달랐다)를
                2026-08-24 사용자 요청("주위에 둥둥 떠다니는 이모티콘들 지워줘")으로 걷었다.
                CSS(.pet-char__sparkle[data-i])와 petSparkle 키프레임, prefers-reduced-motion
                목록의 항목도 함께 지웠다. 이 상자에 남는 것은 그림과 그림자 두 줄이다 —
                그림자 자리(pet.css의 bottom·margin-top 한 쌍)는 반짝임과 무관하므로
                걷어도 펫 위치가 움직이지 않는다 */}
            <div className="pet-char" data-stage={stage}>
              <span className="pet-char__body" aria-hidden="true">
                {petFace}
              </span>
              <span className="pet-char__shadow" aria-hidden="true" />

              {/* 2026-08-21 사용자 결정으로 방에서 이름("북극여우")과 상태 문구("다 자란
                  모습이에요")를 걷었다. Lv. 배지까지 걷힌 지금(위 주석) 방에 보이는 글자는
                  말풍선 대사 한 줄뿐이다.
                  이름은 눈에만 안 보이게 남긴다 — 펫 그림은 alt=""이고 이모지 대체도
                  부모 .pet-char__body가 aria-hidden이라, 이 줄까지 지우면 스크린리더에
                  방 안의 캐릭터가 무엇인지 알려주는 텍스트가 하나도 남지 않는다 */}
              <p className="sr-only">{pet.skinName}</p>
              {/* 2026-08-22 사용자 결정: 캐릭터 밑에 있던 착용 배지("배경1")를 걷었다.
                  배경 그림이 실제로 깔리기 시작하면서 이름표가 정보가 아니라 그림 위
                  잡음이 됐다 — 무엇을 착용했는지는 방 자체가 보여 준다.
                  이름은 눈에만 안 보이게 남긴다. 배경 <img>는 aria-hidden이라 이 줄까지
                  지우면 스크린리더에 착용 정보가 하나도 남지 않는다 (위 skinName과 같은 이유) */}
              {pet.worn.length > 0 ? (
                <p className="sr-only">착용 중: {pet.worn.join(", ")}</p>
              ) : null}
            </div>
          </div>

          {/* 배고픔 게이지가 있던 자리다. 재화 3종과 상점 입구 2개가 대신 들어간다.
              숫자를 아이콘 옆에 글자로 두므로 aria를 따로 붙이지 않는다 — "씨앗 3,000"이
              그대로 읽힌다. 아이콘만 aria-hidden이다 */}
          <div className="pet-card pet-card--wallet">
            <div className="pet-card__head">
              {/* 2026-08-24 이 카드만 이모지를 뺐다가 같은 날 사용자 요청으로 붙였다.
                  안의 재화 아이콘 3개(🌱⭐💛)와 겹치지 않는 것을 골라야 해서 지갑이다 —
                  세 재화 중 하나를 쓰면 제목이 그 줄의 제목처럼 읽힌다 */}
              <p className="pet-card__title">
                <span aria-hidden="true">👛</span> 보유 재화
              </p>
            </div>

            <ul className="pet-wallet">
              {wallet.map((row) => (
                <li className="pet-wallet__row" key={row.name}>
                  <span className="pet-wallet__icon" aria-hidden="true">
                    {row.icon}
                  </span>
                  <span className="pet-wallet__name">{row.name}</span>
                  <span className="pet-wallet__value">{ko(row.value)}</span>
                </li>
              ))}
            </ul>

            {/* 잔액 목록과 상점 입구 사이에 오늘 들어온 재화의 출처 두 줄
                (.pet-wallet__source)이 있었다. 2026-08-24 사용자 요청으로 걷었고, 그 높이는
                아래 상점 입구 두 개가 그대로 받았다(pet.css .pet-wallet__shop의 5rem 계산).
                삭제 이유는 위 sourceLines 자리의 주석에 있다 */}

            {/* 상단 바에서 내려온 상점 입구 2개 (2026-08-21 사용자 결정).
                나무판(.pet-plank)이었다. 같은 날 결정으로 미션 화면의 "오늘 달성률" 카드처럼
                테두리 없는 종족색 면에 가운데 정렬이고, 아이콘 없이 라벨만 둔다 */}
            <div className="pet-wallet__shops">
              <Link className="pet-wallet__shop" href="/pet/skins">
                외형 상점
              </Link>
              <Link className="pet-wallet__shop" href="/pet/cosmetics">
                배경 상점
              </Link>
            </div>
          </div>
        </div>

        <div className="pet__col pet__col--side">
          {/* 경험치 */}
          <div className="pet-card">
            <div className="pet-card__head">
              {/* 제목 앞 이모지는 2026-08-24 사용자 요청으로 되살린 것이다("예전에 있던대로").
                  836cd2b(Figma 이관)에 ⭐ 경험치 · 🌿 씨앗 투입 · 🌟 진화 단계가 있었고
                  d56d813에서 걷혔다. 보유 재화 카드는 안에 이미 🌱⭐💛 아이콘 3개가 있어서
                  처음에는 제외했는데, 같은 날 사용자 요청으로 👛을 붙여 다섯 장 전부가 됐다.
                  design.md의 "이모지는 마스코트 자리에만"에서 벗어나는 자리다. 새 예외가
                  아니라 이 화면이 원래 갖고 있던 예외로 돌아온 것이고, 전부 aria-hidden이라
                  스크린리더가 읽는 카드 이름은 글자 그대로 남는다 */}
              <p className="pet-card__title">
                <span aria-hidden="true">⭐</span> 경험치
              </p>
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
            {/* 2026-08-21 사용자 결정으로 "마지막 단계예요"를 지웠다. 최종 단계에 닿으면
                다음 진화 안내가 없으므로 오른쪽 칸을 비우고 "현재 Lv.N"만 남긴다 —
                빈 <span>을 두면 space-between이 왼쪽 글자를 그대로 왼쪽에 두므로
                자리가 어긋나지는 않는다 */}
            <p className="pet-card__foot">
              <span>현재 Lv.{pet.level}</span>
              {milestone ? <span>{milestone}</span> : null}
            </p>
          </div>

          {/* 방치형 수확. 2026-08-21 사용자 결정으로 아이콘 칸 + 숫자를 왼쪽에 두던 한 줄을
              걷고 경험치·씨앗 투입 카드와 같은 골격(제목 줄 → 주 버튼 → 각주)으로 맞췄다.
              씨앗 이모지는 다른 카드처럼 제목 앞에 글자로만 붙는다 — 색 면을 두지 않는다.

              2026-08-24 사용자 요청("하단에 긴 버튼으로 두지 말고 오른쪽에 정사각형 버튼으로")
              으로 그 골격에서 버튼만 빠져나왔다. 버튼이 오른쪽으로 가면 제목 줄의 오른쪽
              자리가 버튼 것이 되므로 __head를 쓸 수 없고, 개수("N개")가 제목 아래로 내려간다.
              그래서 제목 + 개수를 .pet-idle__body로 묶고 .pet-idle이 그 상자와 버튼을
              한 줄에 세운다. 개수는 클래스를 바꾸지 않았다 — .pet-card__meta 그대로다.

              각주("가득 찼어요")는 .pet-idle 밖에 남긴다. 안에 넣으면 버튼과 같은 줄을
              다투게 되고, 각주는 카드 전체에 붙는 말이라 자리가 카드 맨 아래가 맞다 */}
          <div className="pet-card">
            <div className="pet-idle">
              <div className="pet-idle__body">
                <p className="pet-card__title">
                  <span aria-hidden="true">🌱</span> 그동안 쌓인 씨앗
                </p>
                <span className="pet-card__meta">{ko(pet.idleSeeds)}개</span>
              </div>

              <button
                type="button"
                className="pet-btn pet-btn--seed pet-btn--square"
                onClick={claim}
                disabled={pending || pet.idleSeeds < 1}
                aria-disabled={pending || pet.idleSeeds < 1}
              >
                {/* 2026-08-21 사용자 결정: "씨앗 N개 받기 🌱" → "씨앗 받기" → "씨앗 줍기".
                    개수는 왼쪽 __meta("N개")가 이미 갖고 있어 사라진 정보가 없다.
                    2026-08-24에 버튼이 정사각형이 됐지만 라벨은 그대로다 — 4.5rem 안에
                    한 줄로 들어간다(pet.css의 .pet-btn--square 주석이 그 계산을 갖고 있다) */}
                씨앗 줍기
              </button>
            </div>

            {/* 2026-08-21 사용자 결정으로 각주가 "가득 찼어요" 하나로 줄었다. 지운 두 문구는
                "시간당 N개, 최대 N시간분까지 모여요"와 "다음 씨앗까지 N분"이다.
                msLeft는 화면에서 사라졌을 뿐 계속 돌아간다 — 아래 useEffect가 그 타이머로
                쌓인 개수를 1씩 올리므로 지우면 개수가 새로고침 전까지 멈춘다.
                가득 찼을 때만 각주를 그린다. 빈 <p>를 남기면 gap만큼 카드가 길어진다 */}
            {pet.idleCapped ? (
              <p className="pet-card__foot">
                <em>가득 찼어요</em>
              </p>
            ) : null}
          </div>

          {/* 씨앗 투입. --feed는 이 카드 안의 글씨체를 한 벌로 묶는 변형이다
              (2026-08-21 사용자 결정) */}
          <div className="pet-card pet-card--feed">
            <div className="pet-card__head">
              <p className="pet-card__title">
                <span aria-hidden="true">🌿</span> 씨앗 투입
              </p>
              <span className="pet-card__meta">보유 {ko(pet.seeds)}개</span>
            </div>

            <div className="pet-step">
              <button
                type="button"
                className="pet-step__btn"
                onClick={() => {
                  // −·+로 수를 손대면 개수 버튼의 표시를 끈다. 안 끄면 10을 누른 뒤
                  // −를 눌러 9가 돼도 "10개" 알약이 계속 차 있어 값과 어긋난다
                  //
                  // 2026-08-22 사용자 결정: 개수 버튼이 더하기 전용이 된 뒤에도 −는
                  // 하나씩만 줄인다. "1로 초기화" 버튼은 두지 않는다
                  setLastPreset(null)
                  setAmount((a) => Math.max(1, a - 1))
                }}
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
                onClick={() => {
                  setLastPreset(null)
                  setAmount((a) => Math.min(Math.max(1, pet.seeds), a + 1))
                }}
                disabled={amount >= pet.seeds}
                aria-label="한 개 늘리기"
              >
                +
              </button>
            </div>

            {/* export는 1·5·10·20이었다. 씨앗 1 = 경험치 10이고 Lv.1→2가 100이라
                실제 경제(일일 미션 60/일)에 맞춰 잡았다 — 값은 위 FEED_PRESETS에 있다

                2026-08-22 사용자 요청: 개수 버튼이 "그 값으로 정하기"에서 "그 값만큼
                더하기"로 바뀌었다. 10개를 세 번 누르면 30개다. 최소값(1)에서 누를 때만
                더하지 않고 그 값이 된다 — 1 + 10 = 11이 되면 "10개를 눌렀는데 11"이라
                버튼 이름과 결과가 어긋난다. 그래서 첫 누름은 10, 그다음부터 20·30이다.

                **더한 값이 보유량을 넘으면 자르지 않고 버튼을 막는다**(2026-08-22 사용자
                지적). 보유 27개에서 10개는 10 → 20까지만 눌리고 그 뒤로는 비활성이다.
                자르면 "10개"를 눌렀는데 7개가 들어가 버튼 이름과 결과가 어긋나고, 남은
                씨앗을 의도 없이 다 쓰게 된다. 남은 7개를 넣고 싶으면 5개·1개나 +로 채운다.
                onClick도 넘는 경우 값을 그대로 두는데, 이건 disabled와 겹치는 방어다 —
                눌림과 상태 갱신 사이에 보유량이 줄면(다른 탭에서 먹이기) disabled만으로는
                못 막는다.

                aria-pressed를 뺐다 — 이제 고른 상태가 아니라 실행하는 동작이고,
                누른 값을 표시하는 것은 아래 lastPreset(data-active)이 맡는다 */}
            <div className="pet-presets">
              {FEED_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="pet-preset"
                  data-active={lastPreset === p ? "true" : undefined}
                  aria-label={`${ko(p)}개 더하기`}
                  onClick={() => {
                    setLastPreset(p)
                    setAmount((a) => {
                      const next = feedStep(a, p)
                      return next > pet.seeds ? a : next
                    })
                  }}
                  disabled={feedStep(amount, p) > pet.seeds}
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
              {/* 시안대로 아이콘이 글자 앞이다. aria-hidden으로 빼 두면 버튼 이름이
                  "씨앗 1개 먹이기"로 읽힌다 — 뒤에 있을 때는 이름 끝에 "새싹"이 붙었다 */}
              <span aria-hidden="true">🌱</span> 씨앗 {ko(amount)}개 먹이기
            </button>

            <p className="pet-card__foot">
              <span>씨앗 1개는 경험치 {SEED_TO_EXP}이 돼요</span>
            </p>
          </div>

          {/* 오늘의 활동 (2026-08-24 사용자 요청). 값의 출처와 시안에서 달라진 점은 위
              todayTiles 주석에 있다.

              자리는 오른쪽 열 **맨 아래**다(2026-08-24 사용자 요청: "씨앗 투입 밑으로").
              처음에는 맨 위에 뒀었다 — 요약이 먼저 오는 순서라고 봤다. 내려 보니 그쪽이
              맞다: 위 카드 셋은 다 "지금 무엇을 할 수 있는지"라 눈이 먼저 가야 하고,
              이 카드는 "오늘 무엇이 있었는지"라 다 하고 나서 확인하는 것이다.

              왼쪽 열에 두지 않은 이유는 골격이다 — .pet__col--room이
              grid-template-rows: 1fr auto(방 + 지갑)라 세 번째 카드를 넣으면 그 두 줄
              계산이 깨진다. 이 카드가 왼쪽 열 바닥과 높이를 맞추는 방법은 pet.css의
              .pet__col--side 주석에 있다.

              제목은 처음엔 알약 배지였다(시안이 그 모양이다). 2026-08-24 사용자 요청으로
              걷었다 — 고양이 종족색이 파랑이라 알약이 "제목에 씌워진 파란 동그라미"로
              읽혔다. 이제 다른 카드들과 같은 .pet-card__title 한 줄이다.
              __head로 감싸지 않은 이유는 오른쪽에 넣을 __meta가 없어서다 — 타일 네 칸이
              이미 그 정보를 다 갖고 있다. 감싸도 space-between이 혼자 남은 제목을
              그대로 왼쪽에 두므로 보이는 차이는 없고, 쓰지 않는 래퍼만 늘어난다.

              카드를 감싸던 `todayTiles.length > 0 ?` 조건은 2026-08-24에 걷었다 —
              네 칸이 값과 무관하게 항상 있으므로(위 todayTiles 주석) 조건이 늘 참이다 */}
          <div className="pet-card pet-card--today">
            <p className="pet-card__title">
              <span aria-hidden="true">📊</span> 오늘의 활동
            </p>

            {/* 칸 안의 읽는 순서는 "+275 받은 씨앗"이다. 이모지만 aria-hidden이므로
                스크린리더에는 숫자와 이름만 남는다. 값을 이름보다 앞에 둔 것은 DOM 순서를
                보이는 순서와 같게 유지하려는 것이다 — CSS order로 뒤집으면 눈에 보이는
                순서와 읽히는 순서가 갈려 나중에 고칠 때 한쪽만 맞추게 된다 */}
            <ul className="pet-today">
              {todayTiles.map((tile) => (
                <li className="pet-today__tile" key={tile.name}>
                  <span className="pet-today__icon" aria-hidden="true">
                    {tile.icon}
                  </span>
                  {/* 씨앗 칸만 초록이다. pet.css의 "채도 높은 색은 종족색 하나뿐" 규칙에서
                      씨앗 초록이 유일하게 남은 예외라(--pet-seed 주석) 새 색이 아니다.
                      별조각·친밀도·출석일수는 이 화면이 강조 숫자에 쓰는 --tribe-cta로 묶는다 */}
                  <span className="pet-today__value" data-seed={tile.seed ? "true" : undefined}>
                    {tile.text}
                  </span>
                  <span className="pet-today__name">{tile.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 진화 단계 */}
      <section className="pet-card pet-evo">
        <div className="pet-card__head">
          <h2 className="pet-card__title">
            <span aria-hidden="true">🌟</span> 진화 단계
          </h2>
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
