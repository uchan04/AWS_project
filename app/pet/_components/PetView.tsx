"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import {
  IDLE_MAX_SEEDS,
  IDLE_SEEDS_PER_HOUR,
  MS_PER_IDLE_SEED,
  OUTING_MS,
  PET_IDLE_LINES,
  animalEmoji,
  applySeeds,
  expProgress,
  levelUpReply,
  outingAwayLine,
  outingRemainingLabel,
  seedsToNextStage,
} from "@/lib/pet"
import type { OutingView } from "@/lib/outing"
import { EVOLUTION_LEVEL, SEED_TO_EXP, expToNextLevel } from "@/lib/types"
import { ArtImage } from "@/app/components/ArtImage"
import { CurrencyIcon } from "@/app/components/CurrencyIcon"
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
//
// 2026-08-24 두 갈래(develop / improve)를 합쳤다. 사용자가 항목별로 고른 결과다:
// - 말풍선은 develop 쪽(손그림 SVG + PET_IDLE_LINES 순환, 닫기 가능)을 쓴다.
//   improve 쪽에 있던 petMood() 상태 한 줄(.pet-bubble)은 걷었다 — 같은 자리에 두 계통이
//   말할 수 없다. petMood()가 알리던 두 가지는 다른 자리에 이미 있다:
//   씨앗 상한은 "그동안 쌓인 씨앗" 카드의 각주("가득 찼어요"), 진화 임박은 경험치 카드의
//   각주("N단계까지 씨앗 N개")다. 쓰다듬기·먹이기 반응 대사만 살려서 말풍선을 3초 덮는다
// - 개수 버튼은 develop의 누적 더하기(feedStep). 프리셋은 1·5·10·50
// - 오늘의 활동 3칸(todayTiles)·보유 재화 카드는 develop 것
// - 배고픔 게이지·방 안 씨앗 줍기 버튼·상단 나무판 3개는 지웠다
// - improve에서 가져온 것: 쓰다듬기 반응, 씨앗 0개일 때의 안내, 함께한 기록 카드,
//   먹이기 낙관적 갱신, 방치형 타이머의 절대 시각 계산, ArtImage 폴백

export type PetState = {
  level: number
  exp: number
  evolutionStage: number
  seeds: number
  /** 별조각. **두 상점(외형·배경) 공통 값이다** (2026-08-25 전환) */
  starShards: number
  /** 친밀도. 전환 이후 소모처는 펫 외출 하나다 (2026-08-25) */
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
  /** 상한(IDLE_MAX_SEEDS)에 닿아 누적이 멈춘 상태인지 */
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
  /** 가입일부터 며칠째인가. 가입 당일이 1이다 (lib/pet.ts daysTogether) */
  daysTogether: number
  /** 지금까지 완료한 미션 수(일일 + 단계 전부) */
  missionsDone: number
  /** 누적 출석일 */
  attendanceTotal: number
  /**
   * 펫 외출 세 상태를 한 덩어리로 (SPEC.md 5절). 서버 렌더 시각 기준이고, 남은 시간과
   * 소식 한 줄은 이 화면이 `returnsAt`에서 다시 계산한다(아래 카운트다운 useEffect).
   *
   * `available: false`면 카드를 **아예 그리지 않는다** — 마이그레이션이 아직 안 들어간
   * DB에서 "외출은 곧 열려요" 같은 안내를 띄우면 없는 기능을 광고하는 것이 된다
   */
  outing: OutingView
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

/** 쓰다듬기·먹이기 반응 대사가 말풍선을 덮는 시간 */
const REACTION_MS = 3000

/** 레벨이 오르지 않은 평범한 먹이기의 기본 대사 */
const FEED_REPLY = "맛있어요! 힘이 나요"

/**
 * 외출 카운트다운을 다시 재는 간격.
 *
 * 1초가 아니라 10초다. 표시 단위가 분(`outingRemainingLabel`이 "3시간 12분"까지만 쓴다)이라
 * 1초마다 재도 화면에 바뀌는 글자가 없고 리렌더만 60배 늘어난다. 도착 순간을 잡는 것도
 * 10초면 충분하다 — 4시간을 기다린 사람에게 10초는 즉시다.
 *
 * 방치형 씨앗 타이머와 같은 규칙으로 **절대 시각(returnsAt)과 비교**한다. 남은 ms를
 * tick마다 깎으면 배경 탭에서 타이머가 분당 1회로 줄어 시계가 멈춘다(위 nextSeedAt 주석).
 */
const OUTING_TICK_MS = 10_000

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
  // 말풍선. 닫으면 이 화면에 있는 동안 다시 뜨지 않는다
  const [bubbleClosed, setBubbleClosed] = useState(false)
  // 평상시 대사 순환 위치. null이면 아직 접속 인사를 보여 주는 중이다.
  // 시작 위치는 서버가 정한다 — 여기서 고르면 하이드레이션에서 어긋난다
  const [lineAt, setLineAt] = useState<number | null>(null)
  // 쓰다듬기·먹이기 반응. 3초 동안 파티클을 띄우고, `text`가 있으면 그동안 말풍선까지 덮는다.
  //
  // **`text: null`은 "파티클만"이다 (2026-08-24 사용자 요청 "클릭할 때마다 문구 변하게
  // 하지말고, 5분마다 멘트 바꾸도록 조정해").** 쓰다듬기가 그 경우다 — 누르면 💗만 오르고
  // 말풍선 문장은 그대로 있는다. 같은 날 20초 → 5분으로 올린 순환(IDLE_LINE_MS)이
  // 쓰다듬기 때문에 무의미해지고 있었다: 5분을 기다리는 문장이 클릭 한 번에 바뀌었다.
  // 문장이 바뀌는 유일한 경로는 이제 5분 타이머다(먹이기 답만 예외 — 아래 react 주석).
  //
  // burst는 파티클 span의 key다 — 값이 바뀌면 remount되어 CSS 애니메이션이 처음부터 다시 돈다
  // (같은 요소의 class만 갈면 연속 클릭에서 두 번째부터 애니메이션이 재생되지 않는다)
  const [reaction, setReaction] = useState<{ text: string | null; eat: boolean } | null>(null)
  const [burst, setBurst] = useState(0)
  // 다음 방치형 씨앗이 쌓이는 목표 시각(epoch ms). 0은 "아직 안 심었다"는 뜻이다
  const nextSeedAt = useRef(0)

  // 펫 외출. pet과 따로 담는다 — 세 상태가 한 덩어리로 갈리고(IDLE·AWAY·RETURNED)
  // 보내기·듣기 응답이 이 덩어리를 통째로 갈아 끼우기 때문이다
  const [outing, setOuting] = useState(initial.outing)
  // 남은 밀리초. 첫 값은 **서버가 준 것**이다 — 렌더에서 Date.now()를 읽으면 하이드레이션에서
  // 어긋난다(위 nextSeedAt과 같은 이유). 마운트 뒤 아래 useEffect가 절대 시각으로 다시 잰다
  const [outingLeft, setOutingLeft] = useState(initial.outing.remainingMs)
  // 방금 받아 간 이야기. 수령하면 상태가 IDLE로 떨어져 에피소드가 사라지므로,
  // 다음 외출을 보낼 때까지 이 자리에 남겨 둔다 — 이야기가 이 기능의 값이고,
  // 재화를 받은 순간 그것이 화면에서 없어지면 재화만 남는다
  const [story, setStory] = useState<string[]>([])

  // 말풍선을 덮는 반응 대사. 지금은 먹이기만 여기 온다 — 쓰다듬기는 text가 null이라
  // 파티클만 띄우고 이 값은 계속 null이다(위 reaction 주석)
  const replyLine = reaction?.text ?? null

  // 말풍선에 지금 들어갈 문장. 반응 대사가 있으면 그것이 이기고, 없으면 닫힘 → 접속 인사 →
  // 평상시 대사 순이다. 반응은 닫아 둔 말풍선도 되살린다 — 내가 누른 것에 대한 답이라
  // "닫아 뒀으니 조용히 있어라"의 대상이 아니다
  const bubble = replyLine
    ? replyLine
    : bubbleClosed
      ? null
      : lineAt === null
        ? pet.welcome
        : PET_IDLE_LINES[lineAt]

  const need = expToNextLevel(pet.level)
  const progress = expProgress(pet.level, pet.exp)
  // 방치형 게이지 채움률 (2026-08-24 사용자 요청). 0~1로 자른다 — 서버가 상한을 넘긴 값을
  // 보내는 경우(상한을 나중에 내리면 이미 쌓인 행이 그렇다) 막대가 카드 밖으로 자란다
  const idleProgress = Math.min(1, Math.max(0, pet.idleSeeds / IDLE_MAX_SEEDS))
  // 게이지 밑 각주에 쓰는 "N분마다 1개" (2026-08-24 사용자 요청). 30을 글자로 박지 않고
  // 실제 간격에서 계산한다 — IDLE_SEEDS_PER_HOUR를 만지면 이 문구가 조용히 거짓이 된다
  const idleSeedMinutes = Math.round(MS_PER_IDLE_SEED / 60_000)
  const emoji = animalEmoji(pet.animal)
  // 단일 형태(친밀도 캐릭터)는 단계 크기를 쓰지 않는다. 중간 크기로 고정한다
  const stage = pet.stageCount > 1 ? Math.min(pet.evolutionStage, MAX_STAGE) : 2
  // 다음 진화까지 남은 씨앗. 최종 단계면 null (lib/pet.ts seedsToNextStage)
  const nextStage = seedsToNextStage(pet.level, pet.exp)
  // evolutionStageFor가 MAX_STAGE에서 멈추므로 카드도 그 수를 넘기지 않는다
  const stages = Array.from({ length: Math.min(pet.stageCount, MAX_STAGE) }, (_, i) => i + 1)
  const feedable = Math.min(amount, pet.seeds)

  // ── 펫 외출에서 파생되는 값 ────────────────────────────────────────────────
  //
  // 남은 시간·진행률·소식 한 줄을 **서버가 준 문자열 대신 여기서 다시 만든다.** 4시간짜리
  // 기다림이라 탭을 열어 둔 채 시간이 흐르는 경우가 기본이고, 그때 서버 값은 페이지를 연
  // 시각에 멈춰 있다. 계산은 lib/pet.ts의 같은 순수 함수를 부르므로 두 벌이 되지 않는다.
  const away = outing.state === "AWAY"
  // 진행률을 startedAt이 아니라 남은 시간에서 거꾸로 구한다 — 그러면 화면이 시작 시각을
  // 몰라도 되고, 값의 기준이 카운트다운과 같아진다(둘이 갈리면 게이지와 글자가 어긋난다)
  const outingProgressNow = away
    ? Math.min(1, Math.max(0, 1 - outingLeft / OUTING_MS))
    : outing.progress
  const outingLabel = away ? outingRemainingLabel(outingLeft) : outing.remainingLabel
  // 장소 키에서 다시 만든다. 1막("방금 나갔어") → 2막("지금 공원쯤이야") → 3막("돌아가는 중")이
  // 진행률 1/3·2/3에서 넘어간다. 키가 없으면(예전 응답) 서버 문장을 그대로 쓴다
  const outingLine =
    away && outing.placeKey ? outingAwayLine(outing.placeKey, outingProgressNow) : outing.awayLine
  // 보낼 수 있는지. 부족한 양을 함께 계산해 둔다 — 각주가 "얼마나 더"를 말해야 한다
  const outingShort = Math.max(0, outing.costAffinity - pet.affinity)

  // 재화 3종. 2026-08-21 사용자 결정으로 셋이 같은 칸을 쓴다 — 전에는 씨앗만 초록, 나머지
  // 둘은 나무색이었다. 색은 종족색 하나로 끝내고 구분은 이모지가 한다
  //
  // 2026-08-24 사용자 요청으로 **순서가 씨앗 → 친밀도 → 별조각**이 됐다(전에는 씨앗 →
  // 별조각 → 친밀도). 이 배열이 화면 순서다 — 아래 렌더가 map만 한다.
  // 친밀도 이모지도 같은 요청으로 💛 → ❤️다("페이지 내의 모든 친밀도"). 노란 하트는
  // 이 카드에서 ⭐·🌱과 같은 노란·연두 계열이라 세 줄이 한 색으로 뭉쳐 보였다
  const wallet = [
    { name: "씨앗", icon: <CurrencyIcon currency="seed" size={18} />, value: pet.seeds },
    { name: "친밀도", icon: <CurrencyIcon currency="affinity" size={18} />, value: pet.affinity },
    { name: "별조각", icon: <CurrencyIcon currency="starShard" size={18} />, value: pet.starShards },
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
    { name: "받은 씨앗", icon: <CurrencyIcon currency="seed" size={22} />, text: `+${ko(pet.today.seeds)}`, seed: true },
    { name: "받은 별조각", icon: <CurrencyIcon currency="starShard" size={22} />, text: `+${ko(pet.today.starShards)}`, seed: false },
    // 친밀도 이모지는 2026-08-24 사용자 요청으로 💛 → ❤️였다가, 2026-08-26 모꼬지 재화
    // 에셋으로 다시 바뀌었다. 지갑 줄과 같은 값을 쓴다 — 같은 재화가 두 카드에서
    // 다른 그림이면 같은 것인지 알 수 없다
    { name: "받은 친밀도", icon: <CurrencyIcon currency="affinity" size={22} />, text: `+${ko(pet.today.affinity)}`, seed: false },
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
  //
  // **절대 시각으로 센다.** 전에는 매 tick마다 `left - 1000`으로 깎았다. 브라우저는
  // 배경 탭의 1초 타이머를 분당 1회까지 줄이므로, 탭을 5분 이상 뒤에 두면 30분이
  // 지나도 화면은 30초만 흐른 것으로 셌다 — 돌아와 보면 방에 쌓인 씨앗이 늘지 않았고
  // 새로고침해야 진짜 값이 나왔다.
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
      // 남은 시간을 state에 담지 않는다. 화면에 띄우는 곳이 없어서(아래 방치형 카드 주석)
      // 1초마다 리렌더만 유발했다. 개수가 오를 때만 setPet이 돌면 충분하다
    }, 1000)
    return () => clearInterval(tick)
  }, [pet.idleCapped, pet.idleSeeds, initial.msToNextSeed])

  // 외출 카운트다운. 방치형 타이머와 같은 방식이다 — **목표 시각(returnsAt)과 now를 비교**하고
  // 남은 값을 깎지 않는다. 배경 탭에서 타이머가 느려져도 돌아오면 스스로 따라잡는다.
  //
  // 도착하면 **한 번 다시 읽는다.** 에피소드 세 줄은 서버만 알고 있다(AWAY로 렌더된 응답의
  // episode는 빈 배열이다 — lib/outing.ts toOutingView). 그래서 여기서 상태만 RETURNED로
  // 뒤집으면 이야기 없는 빈 카드가 되고, 새로고침해야 문장이 나온다.
  // `done`으로 한 번만 부른다 — 응답이 늦는 동안 tick이 또 돌면 같은 요청이 겹친다
  useEffect(() => {
    if (outing.state !== "AWAY" || !outing.returnsAt) return
    const target = new Date(outing.returnsAt).getTime()
    let done = false

    const sync = () => {
      const left = Math.max(0, target - Date.now())
      setOutingLeft(left)
      if (left > 0 || done) return
      done = true
      fetch("/api/pet/outing")
        .then((res) => res.json())
        .then((json) => {
          if (json?.data) setOuting(json.data)
        })
        // 실패해도 조용히 둔다. 다음 방문에 서버가 RETURNED로 렌더해 주므로 잃는 것이 없고,
        // 4시간을 기다린 자리에 네트워크 오류 토스트를 띄울 이유가 없다
        .catch(() => {})
    }

    sync()
    const tick = setInterval(sync, OUTING_TICK_MS)
    return () => clearInterval(tick)
  }, [outing.state, outing.returnsAt])

  // 반응 대사 정리. burst에 걸어야 3초 안에 다시 누른 경우 타이머가 새로 시작한다
  useEffect(() => {
    if (!reaction) return
    const t = setTimeout(() => setReaction(null), REACTION_MS)
    return () => clearTimeout(t)
  }, [reaction, burst])

  /**
   * 반응 한 번. `text`가 null이면 파티클만 띄우고 말풍선 문장은 건드리지 않는다.
   * 말풍선을 덮어도 되는 것은 **결과를 알리는 답**뿐이다 — 지금은 먹이기 하나다.
   */
  function react(text: string | null, eat = false) {
    setReaction({ text, eat })
    setBurst((n) => n + 1)
  }

  /**
   * 쓰다듬기. 재화도 저장값도 움직이지 않는다 — 서버를 부르지 않는 순수 상호작용이다.
   * 벤치마크(My Talking Tom·다마고치)에서 펫을 만지는 것은 이 장르의 기본 동작이고,
   * 우리 화면은 그동안 펫을 눌러도 아무 일이 없었다.
   *
   * **2026-08-24 사용자 요청으로 문구를 걷었다** — 누르면 💗 파티클만 오른다. 전에는
   * `petTouchReply(touches)`로 평상시 10문구 중 다음 문장을 말풍선에 꽂았는데, 그게 곧
   * "클릭할 때마다 문구가 변한다"였다. 같은 날 순환을 20초 → 5분으로 올린 뜻(방에 붙어
   * 있는 한 줄로 읽히게)이 클릭 한 번에 무너졌다.
   * `petTouchReply()`는 lib/pet.ts에 남아 있다(check:pet이 "터치 문구는 사용자가 쓴
   * PET_IDLE_LINES 안에 있어야 한다"를 못 박고 있고, 문구를 되살리려면 그 함수가 필요하다).
   */
  function pat() {
    react(null)
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
        imageUrl: next.imageUrl ?? prev.imageUrl,
      }))
      setAmount(1)
      setLastPreset(null)
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

    // 쌓인 개수는 바로 0으로 둔다 — 응답을 기다리는 동안 그대로 남아 있으면 두 번 누른다.
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
      // 수확 직후에는 다음 씨앗까지 꽉 찬 30분이다. 이 줄이 없으면 목표 시각이 과거로
      // 남아 다음 tick이 곧바로 1개를 더 얹는다
      nextSeedAt.current = Date.now() + MS_PER_IDLE_SEED
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

  /**
   * 외출 보내기. 친밀도 200을 내고 4시간 뒤에 이야기를 갖고 돌아온다 (SPEC.md 5절).
   *
   * **낙관적 갱신을 하지 않는다.** 장소·만난 것·기분 3축과 보상은 서버가 뽑아 저장하므로
   * 화면이 미리 알 수 있는 것이 없다 — 먹이기처럼 applySeeds()로 예측할 수 있는 값이 아니다.
   * 친밀도 차감만 미리 그릴 수도 있지만, 그러면 실패했을 때(다른 탭에서 이미 보냈다)
   * 되돌려야 하는 값이 하나 늘고 얻는 것은 400ms짜리 숫자 하나다.
   */
  async function sendOuting() {
    if (pending || away || outing.state === "RETURNED") return
    setPending(true)

    try {
      const res = await fetch("/api/pet/outing", { method: "POST" })
      const json = await res.json()

      if (!res.ok) {
        setToast({ text: json?.error?.message ?? "잠시 후 다시 시도해 주세요", error: true })
        return
      }

      setOuting(json.data)
      setOutingLeft(json.data.remainingMs)
      // 지난 이야기를 치운다. 새 외출이 시작되면 그 자리는 이번 이야기의 것이다
      setStory([])
      setPet((prev) => ({ ...prev, affinity: json.data.affinity }))
      setToast({ text: `밖으로 나갔어요 · ${json.data.remainingLabel} 뒤에 돌아와요` })
      // 상단 재화 HUD가 친밀도를 갖고 있다. 차감했으므로 알린다
      window.dispatchEvent(new CustomEvent("user-stats-changed"))
    } catch {
      setToast({ text: "네트워크 연결을 확인해 주세요", error: true })
    } finally {
      setPending(false)
    }
  }

  /**
   * 돌아온 펫의 이야기를 듣고 재화를 받는다. 지급은 서버가 calculateReward()로 한다.
   *
   * 받은 뒤 상태는 IDLE로 떨어지지만 **이야기는 story에 남겨 화면에 둔다** — 위 story 주석.
   */
  async function hearOuting() {
    if (pending || outing.state !== "RETURNED") return
    setPending(true)

    try {
      const res = await fetch("/api/pet/outing/claim", { method: "POST" })
      const json = await res.json()

      if (!res.ok) {
        setToast({ text: json?.error?.message ?? "잠시 후 다시 시도해 주세요", error: true })
        return
      }

      const next = json.data
      setStory(next.episode)
      // 서버가 준 값으로 갈지 않고 EMPTY와 같은 IDLE로 접는다. 다음 외출 전까지 이 카드가
      // 보여 줄 것은 보내기 버튼과 지난 이야기뿐이다
      setOuting((prev) => ({
        ...prev,
        state: "IDLE",
        returnsAt: null,
        remainingMs: 0,
        remainingLabel: "",
        progress: 0,
        awayLine: null,
        placeKey: null,
        episode: [],
        reward: null,
      }))
      setOutingLeft(0)
      setPet((prev) => ({ ...prev, seeds: next.seeds, starShards: next.starShards }))
      // 반가움. 문구를 새로 만들지 않고 💗 파티클만 올린다 — 말풍선에 오는 문장은
      // 사용자가 쓴 20문구와 먹이기 답뿐이라는 규칙을 지킨다(위 pat·react 주석)
      react(null)
      setToast({
        text: `이야기를 들었어요 · 씨앗 +${ko(next.gained.seeds)} · 별조각 +${ko(next.gained.starShards)}`,
      })
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
      {/* 재화와 상점 입구는 아래 지갑 카드가 갖는다. 상단은 제목만 남긴다.
          2026-08-24: 나무판 3개(잠깐 쉬기·외형 상점·배경 상점)를 걷었다. 상점 2개는
          지갑 카드가 이미 갖고 있어 같은 링크가 한 화면에 두 벌이었고, 잠깐 쉬기는
          맨 아래 각주로 내렸다 — 사용자 결정 */}
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
                **문장을 바꾸는 것은 그 5분 타이머뿐이다** (2026-08-24 사용자 요청) —
                펫을 눌러도 이 자리는 그대로고 파티클만 오른다. 먹이면 3초 동안 그 답이
                이 자리를 덮는다(위 bubble·react 주석).
                문장 목록과 규칙은 lib/pet.ts "펫 대사" 절에 있다.

                말풍선을 캐릭터 **위**에 두고 꼬리를 아래로 내려 펫이 말하는 것으로 읽히게
                한다. 방이 min-height 27rem이고 .pet-char는 bottom: 0이라 위쪽이 비어 있다.

                aria-live를 걸지 않았다. 주기마다 스크린리더가 대사를 읽으면 화면을 쓰는
                내내 말이 끼어든다 — 이건 알림이 아니라 방 안의 혼잣말이라 그 자리에 있는
                글자로 충분하다. 대신 문장이 바뀔 때 DOM에 그대로 남으므로 훑어 읽을 수 있다 */}
            {/* 아래 data-tone은 먹이기에만 준다 (2026-08-24 사용자 결정). 쓰다듬기에도
                "touch" 톤(갈색 테두리)을 줬는데, 그게 "이 문구는 사용자가 쓴 20문구가
                아니다"를 눈으로 알려 주는 표시가 되어 있었다. 같은 날 쓰다듬기 문구 자체가
                걷혀서(위 pat 주석) 이제 이 말풍선에 오는 문장은 사용자가 쓴 20문구 아니면
                먹이기 답 둘뿐이다. 먹이기 톤은 남긴다 — 레벨업 알림처럼 결과를 알리는 자리다 */}
            {/* 외출 중에는 말풍선을 그리지 않는다. 방에 없는 펫이 방 안에서 말할 수 없다 —
                밖에서 오는 한 줄은 아래 .pet-away 쪽지가 갖는다 */}
            {bubble && !away ? (
              <div className="pet-welcome" data-tone={reaction?.eat ? "eat" : undefined}>
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
                {/* 반응 대사일 때는 닫기를 그리지 않는다. 3초면 스스로 사라지고, 그때 닫으면
                    반응이 끝난 뒤 평상시 대사까지 같이 사라져 이유를 알 수 없다.
                    reaction이 아니라 replyLine으로 보는 이유: 쓰다듬기는 문장을 덮지 않으므로
                    누른 뒤 3초 동안 닫기 버튼이 사라질 이유가 없다 */}
                {replyLine ? null : (
                  <button
                    type="button"
                    className="pet-welcome__close"
                    onClick={() => setBubbleClosed(true)}
                    aria-label="펫 말풍선 닫기"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : null}

            {/* 2026-08-23 사용자 요청으로 머리 위 Lv. 배지를 걷었다. 말풍선을 캐릭터 바로
                위에 붙이려면 배지가 그 자리를 쓰고 있었다 — 방을 27rem으로 키운 뒤에도
                좁은 화면에서는 말풍선과 배지가 겹쳤다(위 .pet-welcome 주석의 계산).
                레벨은 아래 진화 카드의 "현재 Lv.N"에 그대로 있으므로 정보가 사라지지 않는다.
                배지 CSS(.pet-char__badge)와 petBounceBadge 키프레임도 함께 걷었다 */}
            {/* 반짝임 3개(✨⭐✨)를 2026-08-24 사용자 요청("주위에 둥둥 떠다니는 이모티콘들
                지워줘")으로 걷었다가 **같은 날 develop 병합에서 사용자 결정으로 되살렸다.**
                develop이 이 상자에 쓰다듬기 버튼과 반응 파티클을 붙여 놓았고, 셋을 한 벌로
                가져오는 쪽을 골랐다. 방의 떠다니는 씨앗(.pet-room__seeds)은 되살리지 않았다 —
                그쪽은 develop에도 새 기능이 붙지 않아 지운 상태 그대로다.
                CSS(.pet-char__sparkle[data-i])와 petSparkle 키프레임, prefers-reduced-motion
                목록의 항목도 pet.css에서 함께 되살렸다 */}
            {/* 외출 중인 방 (SPEC.md 5절).
                **이 자리의 톤이 이 기획의 성패다.** 고립은둔 서비스에서 아무도 없는 방이
                "혼자 남았다"로 읽히면 안 되고 "곧 돌아온다"로 읽혀야 한다. 그래서 펫이 없는
                동안 방을 비우지 않고, 펫이 남긴 쪽지를 그 자리에 둔다 — 벤치마크한 Finch가
                새를 여행 보내는 동안 여정 카드를 남기는 것과 같은 장치다.
                문장은 진행률에 따라 3막으로 바뀐다(위 outingLine, lib/pet.ts OUTING_AWAY_LINES).
                남은 시간과 게이지는 여기 적지 않는다 — 오른쪽 외출 카드가 갖는다.
                방은 펫의 목소리, 카드는 사실. 같은 것을 두 곳에 쓰지 않는다 */}
            {away ? (
              <div className="pet-away">
                {/* 손으로 찢어 쓴 쪽지. 말풍선과 같은 방식이다 — SVG path 하나에
                    면은 카드색(배경 그림 6종 위에서 명암비를 지키는 유일한 색),
                    선은 종족색, 굵기는 vector-effect로 3px 고정 */}
                <svg
                  className="pet-away__paper"
                  viewBox="0 0 208 104"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    vectorEffect="non-scaling-stroke"
                    d="M10 12C70 6 140 6 198 11C201 40 202 68 198 95C140 100 70 100 10 95C6 68 6 40 10 12Z"
                  />
                </svg>
                {/* 이 한 줄이 있어야 현재형 문장("지금 공원쯤이야")이 앞뒤가 맞는다.
                    쪽지만 두면 나갈 때 써 두고 간 글이 되어 시간이 흐르는 것과 어긋난다 */}
                <p className="pet-away__from">밖에서 온 소식</p>
                <p className="pet-away__text">{outingLine}</p>
              </div>
            ) : null}

            {/* hidden으로 접는다(외출 중). 조건부 렌더로 이 50줄을 감싸는 것과 결과가 같다 —
                display: none은 탭 순서와 접근성 트리에서도 빠지므로 쓰다듬기 버튼이 남지 않는다.
                .pet-char가 display: grid를 갖고 있어 UA의 [hidden] 규칙을 덮으므로
                pet.css에 .pet-char[hidden] 한 줄이 함께 있다 */}
            <div className="pet-char" data-stage={stage} hidden={away}>
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
                  안의 재화 아이콘 3개(🌱❤️⭐)와 겹치지 않는 것을 골라야 해서 처음에는
                  지갑(👛)이었다 — 세 재화 중 하나를 쓰면 제목이 그 줄의 제목처럼 읽힌다.
                  같은 날 사용자 요청으로 **노란 코인(🪙)**이 됐다. 코인도 세 재화 아이콘과
                  겹치지 않으므로 그 이유는 그대로 지켜진다 */}
              <p className="pet-card__title">
                <span aria-hidden="true">🪙</span> 보유 재화
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
                (.pet-wallet__source)이 있었다. 2026-08-24 사용자 요청으로 걷었고, 그 높이(36px)를
                아래 상점 입구 두 개가 5rem으로 두꺼워지며 받았다. 같은 날 마지막 요청으로 그
                두께가 먹이기 버튼과 같은 44px로 돌아갔으므로 **지금 이 카드는 그만큼 짧다** —
                남는 높이는 위 방(.pet__col--room의 1fr)이 가진다. 자세한 사정은 pet.css의
                .pet-wallet__shop 주석, 삭제 이유는 위 sourceLines 자리의 주석에 있다 */}

            {/* 상단 바에서 내려온 상점 입구 2개 (2026-08-21 사용자 결정).
                나무판(.pet-plank)이었다. 같은 날 결정으로 미션 화면의 "오늘 달성률" 카드처럼
                테두리 없는 종족색 면에 가운데 정렬이고, 아이콘 없이 라벨만 둔다.

                2026-08-24 사용자 요청("그냥 외형 상점이랑 배경 상점 버튼을 씨앗 먹이기 버튼
                객체랑 똑같은 걸로 바꿔줘. 크기도 비슷했으면 좋겠어"): 먹이기 버튼이 쓰는
                **그 클래스를 그대로 붙인다**(.pet-btn.pet-btn--block). 값을 베껴 쓰지 않는
                이유는 그러면 다음에 먹이기 버튼만 바뀌었을 때 둘이 갈리는 것이다.
                단, 먹이기 버튼의 실제 크기·글자·그림자는 .pet-btn 본체가 아니라
                `.pet-card--feed .pet-btn`에 있어서 이것만으로는 겉보기가 달랐다(같은 날
                사용자 지적 "…동일한 폰트, 동일한 굵기"). 그래서 pet.css에서 그 규칙의
                선택자에 .pet-wallet__shop을 함께 넣었다 — 자세한 사정은 그 두 주석 */}
            <div className="pet-wallet__shops">
              <Link className="pet-btn pet-btn--block pet-wallet__shop" href="/pet/skins">
                외형 상점
              </Link>
              <Link className="pet-btn pet-btn--block pet-wallet__shop" href="/pet/cosmetics">
                배경 상점
              </Link>
            </div>
          </div>
        </div>

        <div className="pet__col pet__col--side">
          {/* 펫 외출 (SPEC.md 5절, 계획은 docs/dev/pet.md "펫 외출 시스템").
              친밀도 200 → 4시간 → 이야기 세 줄 + 씨앗·별조각.

              **available: false면 카드가 아예 없다.** 마이그레이션(PetOuting)이 아직 안 들어간
              DB에서는 lib/outing.ts가 그렇게 내려보낸다 — 있지도 않은 기능을 "곧 열려요"로
              광고하는 것보다 없는 편이 낫고, 이 화면의 다른 카드는 그대로 돈다.

              자리를 오른쪽 열 **맨 위**로 잡았다. 왼쪽 열에 둘 수 없는 것이 골격 때문이다
              (.pet__col--room이 grid-template-rows: 1fr auto라 세 번째 카드를 넣으면 방과
              지갑의 높이 계산이 깨진다 — pet.css .pet__col--side 주석). 오른쪽 열 안에서
              맨 위인 이유는 이것이 **새로 생긴 주 동작**이라서다: 좁은 화면에서 방 → 지갑
              다음이 이 카드라 방에 남은 쪽지를 본 사람이 곧바로 남은 시간을 만난다.
              오늘의 활동이 맨 아래인 것과 같은 판단이다("지금 할 수 있는 것"이 먼저다) */}
          {outing.available ? (
            <div className="pet-card pet-card--outing" data-state={outing.state}>
              <div className="pet-card__head">
                <p className="pet-card__title">
                  {/* 이 화면 카드 제목은 전부 이모지 하나로 시작한다(위 경험치 카드 주석).
                      🚪는 다른 넷(⭐🌱🌿📊🪙)과 겹치지 않고 재화 아이콘도 아니다 */}
                  <span aria-hidden="true">🚪</span> 펫 외출
                </p>
                <span className="pet-card__meta">
                  {away ? `${outingLabel} 뒤` : `친밀도 ${ko(outing.costAffinity)}`}
                </span>
              </div>

              {away ? (
                <>
                  {/* 게이지 골격은 경험치·방치형 카드와 **같은 클래스**다. 채움색만 기본
                      종족색을 쓴다 — 초록(--pet-gauge--seed)은 씨앗 전용이고 이 막대는
                      시간이다. aria는 퍼센트로 준다: 남은 ms를 읽어 주면 소용이 없다 */}
                  <div
                    className="pet-gauge"
                    role="progressbar"
                    aria-label="돌아오기까지"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(outingProgressNow * 100)}
                  >
                    <div
                      className="pet-gauge__fill"
                      style={{ width: `${outingProgressNow * 100}%` }}
                    />
                  </div>
                  {/* 각주 골격도 다른 카드와 같다(왼쪽 설명 / 오른쪽 강조 한 덩어리).
                      버튼을 두지 않는다 — 기다리는 동안 누를 것이 있으면 기다림이 과제가 된다 */}
                  <p className="pet-card__foot">
                    <span>밖에 나갔어요</span>
                    <em>{outingLabel} 뒤 도착</em>
                  </p>
                </>
              ) : outing.state === "RETURNED" ? (
                <>
                  {/* 이야기 세 줄. 장소 → 만난 것 → 기분 순이고 문장은 lib/pet.ts에 있다.
                      key에 문장을 쓴다 — 세 줄이 서로 다른 풀에서 오므로 겹칠 수 없다 */}
                  <ul className="pet-story">
                    {outing.episode.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="pet-btn pet-btn--block"
                    onClick={hearOuting}
                    disabled={pending}
                    aria-disabled={pending}
                  >
                    이야기 듣기
                  </button>
                  {/* 받을 양을 누르기 **전에** 보여 준다. 저장값이 아니라 스킨 배율까지 얹은
                      실지급액이다(lib/outing.ts toOutingView reward 주석) */}
                  <p className="pet-card__foot">
                    <span>돌아왔어요</span>
                    {outing.reward ? (
                      <em>
                        씨앗 +{ko(outing.reward.seeds)} · 별조각 +{ko(outing.reward.starShards)}
                      </em>
                    ) : null}
                  </p>
                </>
              ) : (
                <>
                  {/* 방금 들은 이야기는 다음 외출을 보낼 때까지 남는다(위 story 주석).
                      --past는 글자를 흐리게 하는 변형이다 — 지금 일이 아니라 지난 일이다 */}
                  {story.length > 0 ? (
                    <ul className="pet-story pet-story--past">
                      {story.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  <button
                    type="button"
                    className="pet-btn pet-btn--block"
                    onClick={sendOuting}
                    disabled={pending || outingShort > 0}
                    aria-disabled={pending || outingShort > 0}
                  >
                    외출 보내기
                  </button>
                  {/* 부족하면 남은 양을 말한다. 어디서 친밀도를 얻는지는 챗봇·커뮤니티인데
                      (page.tsx 친밀도 주석) 그 링크를 여기 두지 않는다 — 이 카드는 오른쪽 열
                      다섯 장 중 하나이고, 각 카드가 각주에 링크를 갖기 시작하면 화면이
                      권유로 덮인다. 씨앗 0개 안내(.pet-empty)에 링크가 있는 것은 그 카드가
                      **주 동작이 막힌 상태**이기 때문이고, 외출은 부가 동작이다 */}
                  <p className="pet-card__foot">
                    <span>{outing.hours}시간 뒤에 이야기를 갖고 돌아와요</span>
                    {outingShort > 0 ? <em>친밀도 {ko(outingShort)} 더 필요해요</em> : null}
                  </p>
                </>
              )}
            </div>
          ) : null}

          {/* 경험치 */}
          <div className="pet-card">
            <div className="pet-card__head">
              {/* 제목 앞 이모지는 2026-08-24 사용자 요청으로 되살린 것이다("예전에 있던대로").
                  836cd2b(Figma 이관)에 ⭐ 경험치 · 🌿 씨앗 투입 · 🌟 진화 단계가 있었고
                  d56d813에서 걷혔다. 보유 재화 카드는 안에 이미 🌱❤️⭐ 아이콘 3개가 있어서
                  처음에는 제외했는데, 같은 날 사용자 요청으로 👛(→ 같은 날 🪙)을 붙여
                  다섯 장 전부가 됐다.
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
              {/* 게이지 안에 {exp} / {need}를 겹쳐 쓰던 것을 지웠다 (2026-08-23).
                  바로 위 .pet-card__meta가 **같은 문자열**을 이미 쓴다 — 8px 간격으로
                  같은 숫자가 두 번이었다. 지운 쪽이 게이지 안이다:
                  움직이는 그라디언트 위 글자라 대비가 채움률에 따라 변한다.
                  배경 상점의 .pet-gauge__value는 그 게이지의 **유일한** 라벨이라 남는다 */}
              <div className="pet-gauge__fill" style={{ width: `${progress * 100}%` }} />
            </div>
            {/* 지금까지 `Lv.25 마지막 진화`만 보여 줬다. 그 문구는 지금 무엇을 얼마나
                해야 하는지 알려 주지 않는다. 벤치마크한 육성 게임은 전부 남은 개수를 쓴다
                (2026-08-24 사용자 확정: seedsToNextStage 쪽을 쓴다) */}
            <p className="pet-card__foot">
              <span>현재 Lv.{pet.level}</span>
              <span>
                {nextStage
                  ? `${STAGE_NAME[nextStage.stage - 1] ?? `${nextStage.stage}단계`}까지 씨앗 ${ko(nextStage.seeds)}개`
                  : "마지막 단계예요"}
              </span>
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

              방 안의 씨앗을 직접 줍는 버튼(.pet-room__pickup)도 같은 claim()을 불렀는데
              2026-08-24 사용자 결정으로 걷었다. 수확 입구는 이 버튼 하나다.

              각주("가득 찼어요")는 .pet-idle 밖에 남긴다. 안에 넣으면 버튼과 같은 줄을
              다투게 되고, 각주는 카드 전체에 붙는 말이라 자리가 카드 맨 아래가 맞다

              2026-08-24 사용자 요청("그동안 쌓인 씨앗도 게이지 요소를 씨앗줍기버튼 왼쪽에
              놔줘. 게이지의 최대치인 맥시멈을 200으로 둘 거야" → 같은 대화에서 **100으로
              확정**)으로 왼쪽 상자에 게이지가 붙었다. 최대치는 화면에 적는 숫자가 아니라
              **실제 상한**(IDLE_MAX_SEEDS)이다 — 게이지가 100에서 끝나는데 씨앗이 24에서
              멈추면 막대가 12%를 넘지 못한다. 그래서 상한을 100개(50시간분)로 함께 올렸다
              (lib/pet.ts IDLE_CAP_HOURS 주석에 그 결정과 수급 영향이 있다) */}
          <div className="pet-card">
            <div className="pet-idle">
              <div className="pet-idle__body">
                {/* 2026-08-24 사용자 요청("3/100 개 문구를 그동안 쌓인 씨앗 옆으로 옮겨")으로
                    제목과 개수가 한 줄이 됐다. 새 규칙을 만들지 않고 **옆 카드들과 같은
                    .pet-card__head**를 쓴다 — 경험치·씨앗 투입 카드가 이미 "제목 왼쪽 /
                    현재·최대 오른쪽"이고, 이 카드만 개수를 제목 아래에 두던 것이 8/24에
                    버튼이 오른쪽으로 나가며 생긴 예외였다. 그 예외가 이 요청으로 닫혔다.
                    카드 높이는 그대로다 — 줄 높이를 정하는 쪽이 여전히 4.5rem 버튼이다 */}
                <div className="pet-card__head">
                  <p className="pet-card__title">
                    <CurrencyIcon currency="seed" size={16} /> 그동안 쌓인 씨앗
                  </p>
                  {/* "N개"에서 "N / 100개"로 늘렸다. 경험치 카드가 게이지 위에 같은 형태로
                      현재/최대를 적는다 — 분모가 없으면 막대가 어디서 끝나는지 알 수 없다 */}
                  <span className="pet-card__meta">
                    {ko(pet.idleSeeds)} / {ko(IDLE_MAX_SEEDS)}개
                  </span>
                </div>
                {/* 골격은 경험치 게이지와 **같은 클래스**다(높이·테두리·홈 그림자·전환).
                    2026-08-24 사용자 요청("게이지 색을 씨앗줍기버튼과 같은 초록색으로")으로
                    채움색만 --pet-gauge--seed 변형으로 갈린다. 오른쪽 버튼이 초록이므로
                    한 줄 안에서 막대와 버튼이 같은 재화를 가리키는 것으로 읽힌다.
                    게이지 안에 숫자를 겹쳐 쓰지 않는다(.pet-gauge__value) — 위 __head의
                    __meta가 같은 문자열을 이미 갖고 있다(경험치 카드와 같은 사정) */}
                <div
                  className="pet-gauge pet-gauge--seed"
                  role="progressbar"
                  aria-label="그동안 쌓인 씨앗"
                  aria-valuemin={0}
                  aria-valuemax={IDLE_MAX_SEEDS}
                  aria-valuenow={pet.idleSeeds}
                >
                  <div className="pet-gauge__fill" style={{ width: `${idleProgress * 100}%` }} />
                </div>
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
                타이머 자체는 계속 돌아간다 — 위 useEffect가 그것으로 쌓인 개수를 1씩
                올리므로 지우면 개수가 새로고침 전까지 멈춘다.

                2026-08-24 사용자 요청("경험치 카드칸의 게이지 밑에 레벨 문구를 적었듯이
                그동안 쌓인 씨앗 게이지 바로 밑에 30분마다 1개의 씨앗이 생성돼요 라는 문구"):
                **8/21에 지운 속도 문구가 사용자 결정으로 돌아왔다.** 그때 지운 이유는
                각주 세 줄이 카드를 무겁게 만든 것이었고, 지금은 한 줄이다.
                문장은 사용자가 쓴 그대로 두고 30만 상수에서 계산한다(위 idleSeedMinutes).

                골격은 경험치 카드의 각주와 **같은 .pet-card__foot**이다 — 요청이 "경험치
                카드처럼"이고, 그 카드도 게이지 아래 이 클래스에 span 2개를 space-between으로
                둔다(현재 Lv.N / 다음 단계까지 씨앗 N개). 그래서 자리는 .pet-idle 밖,
                카드 맨 아래다. 안(왼쪽 상자)에 넣으면 버튼과 같은 줄을 다투고, 각주는
                카드 전체에 붙는 말이다.
                "가득 찼어요"는 지우지 않고 같은 줄의 오른쪽으로 옮겼다 — 두 문장이 각각
                "얼마나 빨리 차는지"와 "지금 더 안 찬다"라서 함께 있을 때 뜻이 이어진다.
                이제 각주가 항상 있으므로 8/21에 조건부로 만든 이유(빈 <p>가 gap만큼
                카드를 늘린다)는 해당하지 않는다 */}
            <p className="pet-card__foot">
              <span>{idleSeedMinutes}분마다 1개의 씨앗이 생성돼요</span>
              {pet.idleCapped ? <em>가득 찼어요</em> : null}
            </p>
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

            {/* 씨앗이 0개면 조작부를 전부 비활성으로 두지 않는다. 전에는 스테퍼·개수 버튼
                4개·먹이기 버튼이 모두 회색으로 남아 **어디서 씨앗을 얻는지는 아무데도
                적혀 있지 않았다** — 처음 온 사람이 가장 자주 만나는 상태다.
                고장난 화면 대신 다음 행동(미션) 하나만 보여 준다 */}
            {pet.seeds < 1 ? (
              <div className="pet-empty">
                <p className="pet-empty__text">씨앗이 없어요. 미션을 하나 해내면 씨앗이 생겨요</p>
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
                    누른 값을 표시하는 것은 lastPreset(data-active)이 맡는다 */}
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
                  disabled={pending || amount > pet.seeds}
                  aria-disabled={pending || amount > pet.seeds}
                >
                  {/* 글자 앞에 🌱이 있었다(시안대로). 2026-08-24 사용자 요청("씨앗 먹이기
                      버튼 속 문구에서 새싹 이모티콘 삭제해줘")으로 걷었다. 스크린리더가 읽는
                      이름은 전부터 aria-hidden 덕에 "씨앗 1개 먹이기"였으므로 이 삭제로
                      바뀌지 않는다. 같은 카드의 제목(🌱 씨앗 투입)과 위 지갑 줄의 🌱은
                      그대로다 — 요청이 버튼 문구 하나였다 */}
                  씨앗 {ko(amount)}개 먹이기
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

          {/* develop의 "📖 함께한 기록" 카드(함께한 날 · 해낸 미션 · 출석)가 여기 있었다.
              **2026-08-24 병합에서 사용자 결정으로 가져오지 않았다.** 그 카드의 출석 칸이
              아래 "오늘의 활동" 네 번째 칸(같은 user.attendanceTotal)과 같은 수를 한 화면에
              두 번 보여 주게 되고, 두 카드 중 하나를 고르는 자리에서 오늘의 활동 쪽이
              같은 날 사용자 요청으로 만들어진 것이다.
              데이터는 그대로 내려온다 — PetState의 daysTogether·missionsDone·attendanceTotal은
              app/pet/page.tsx가 계속 채우고, pet.css의 .pet-log 규칙도 남아 있다.
              되살릴 일이 생기면 그 두 벌이 이미 있으므로 이 자리에 카드만 다시 세우면 된다 */}

          {/* 오늘의 활동 (2026-08-24 사용자 요청). 값의 출처와 시안에서 달라진 점은 위
              todayTiles 주석에 있다.

              자리는 오른쪽 열 **맨 아래**다(2026-08-24 사용자 요청: "씨앗 투입 밑으로").
              처음에는 맨 위에 뒀었다 — 요약이 먼저 오는 순서라고 봤다. 내려 보니 그쪽이
              맞다: 위 카드들은 다 "지금 무엇을 할 수 있는지"라 눈이 먼저 가야 하고,
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
          {/* 헤더의 effectLabel을 지웠다 (2026-08-23). 같은 섹션 안 "현재" 카드가
              같은 문자열을 이미 쓴다(.pet-evo-card__effect). 카드 쪽을 남긴 이유는
              그쪽이 "어느 단계에 붙은 효과인가"를 같이 말하기 때문이다 —
              헤더 meta는 4칸을 다 본 뒤에도 같은 말을 반복하는 것뿐이었다 */}
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

      {/* 쉬는 화면(/pet/rest) 입구. 상단 나무판을 걷으면서 유일한 입구가 사라졌다.
          각주 크기로 화면 맨 아래에 둔다(2026-08-24 결정) — 홈·미션에서 링크하지 않는
          이유와 같다. 쉬는 화면을 눈에 띄는 자리에서 권하면 "쉬어라"는 지시가 된다.
          찾아온 사람만 닿으면 되고, 여기 있다는 사실만 남으면 된다 */}
      <p className="pet__rest">
        <Link href="/pet/rest">잠깐 쉬어 가기</Link>
      </p>

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
