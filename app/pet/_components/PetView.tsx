"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import {
  IDLE_MAX_SEEDS,
  IDLE_SEEDS_PER_HOUR,
  OUTING_COST_AFFINITY,
  OUTING_REWARD_MAX,
  OUTING_REWARD_MIN,
  MS_PER_IDLE_SEED,
  OUTING_MS,
  PET_IDLE_LINES,
  animalEmoji,
  canGoOuting,
  OUTING_LOCK_MESSAGE,
  outingNeedAffinityMessage,
  applySeeds,
  expProgress,
  levelUpReply,
  outingAwayLine,
  outingRemainingLabel,
  seedsToNextStage,
} from "@/lib/pet"
import { OUTING_HISTORY_LIMIT, type OutingHistoryItem, type OutingView } from "@/lib/outing"
import { EVOLUTION_LEVEL, SEED_TO_EXP, expToNextLevel } from "@/lib/types"
// 안내 문구의 숫자를 손으로 적지 않는다 — 값이 바뀌면 문구가 조용히 거짓이 된다.
// ChatPanel도 같은 모듈에서 상수만 가져온다(클라이언트 컴포넌트에서 이미 쓰는 방식).
import {
  AFFINITY_CAP_BY_SOURCE,
  CHAT_TURN_AFFINITY,
  POST_AFFINITY,
  COMMENT_AFFINITY,
  MEETUP_JOIN_AFFINITY,
} from "@/app/community/_lib/affinity"
import { AFFINITY_DAILY_CAP } from "@/lib/reward"
// 배경 가격. prisma/seed/items.ts의 PRICE_BY_RARITY.COMMON과 같은 값이어야 한다 —
// 그 파일은 시드(Node 전용)라 클라이언트에서 import하면 번들에 시드 코드가 섞인다.
// 값이 갈리는 것을 막는 자리는 check:pet이다(그쪽이 시드 표를 직접 읽는다).
const BACKGROUND_PRICE_SHARDS = 500
import { ArtImage } from "@/app/components/ArtImage"
import { useModalA11y } from "@/app/components/useModalA11y"
import { CurrencyIcon } from "@/app/components/CurrencyIcon"
import PetRoom from "./PetRoom"
import { PetIcon } from "./PetIcon"
import { cdnUrl } from "@/lib/assets"
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
 * 보관함 목록의 날짜. `08. 26`처럼 짧게 쓴다 — 목록은 한 줄에 날짜·제목·재화가 함께
 * 서므로 연도가 들어갈 폭이 없다. 일기 안에는 연도까지 있다(OutingDiaryModal).
 * `toLocaleDateString`을 쓰지 않는 이유도 그쪽과 같다: 로케일마다 자리 폭이 흔들린다.
 */
function historyDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}`
}

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
  const router = useRouter()
  const [pet, setPet] = useState(initial)
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [evolvedTo, setEvolvedTo] = useState<number | null>(null)
  const [playingAnimation, setPlayingAnimation] = useState<"leave" | "return" | null>(null)
  const [isAnimFadingOut, setIsAnimFadingOut] = useState(false)
  const [hasSeenReturnPopup, setHasSeenReturnPopup] = useState(false)
  const [amount, setAmount] = useState(0)
  // 증감 단위 (기본 1)
  const [step, setStep] = useState(1)
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
  /**
   * 여행일기 팝업 (2026-08-26 사용자 결정). `결과 확인`을 누른 뒤에만 열린다.
   *
   * 카드 안에 이야기를 펼치지 않는 이유는 지갑 안내와 같다 — 이 카드는 오른쪽 좁은 열에
   * 있고, 5축 구조로 가면 일기가 최대 11줄이 된다. 카드 안에서는 읽을 수 없다.
   * 받은 재화를 함께 담으므로 토스트는 띄우지 않는다 (같은 값을 두 번 말하지 않는다).
   */
  const [diary, setDiary] = useState<{
    /** 본문 위 제목. 서버가 저장된 legs에서 계산해 준다(lib/outing.ts outingTitleFor) */
    title: string
    /** 상단 날짜(ISO). 화면이 `YYYY. MM. DD`로 만든다 */
    returnedAt: string
    episode: string[]
    gained: { seeds: number; starShards: number }
  } | null>(null)

  // 2026-08-26 개편: 카드 5장이 모달로 들어갔다. **상태를 하나로 둔다**(시안과 같은 방식) —
  // boolean 5개면 둘이 동시에 열린 상태를 코드가 표현할 수 있게 되고, 그 조합은 화면에서
  // 뜻이 없다(모달 위에 모달은 이 앱에 없다). null이 "닫힘"이다
  const [modal, setModal] = useState<"seed" | "shop" | "today" | "info" | "history" | "menu" | null>(null)
  const closeModal = () => setModal(null)

  /**
   * 여행일기 보관함 (2026-08-26 사용자 요청). **최근 10건만** 본다.
   *
   * `보관함 → 목록 → 일기` 세 단계다. 목록에서 한 줄을 누르면 같은 종이 일기 팝업이
   * 열리는데, 그때는 **읽기 전용**이다 — 재화를 다시 주지 않는다(수령은 `POST /claim`
   * 하나뿐이다).
   *
   * `undefined`(아직 안 불렀다) / `null`(실패) / 배열을 구분한다. 홈 미션 카드가 로딩 중에
   * 실패 문구를 띄우던 버그(차단 3번)와 같은 갈림이다 — 하나로 합치면 여는 순간
   * "기록이 없어요"가 깜빡인다.
   */
  const [history, setHistory] = useState<OutingHistoryItem[] | null | undefined>(undefined)
  /** 목록에서 고른 한 건. 열려 있으면 종이 일기가 읽기 전용으로 뜬다 */
  const [historyPick, setHistoryPick] = useState<OutingHistoryItem | null>(null)

  /** 보관함을 열 때만 부른다 — 화면 진입에서 왕복을 늘리지 않는다 */
  async function openHistory() {
    setModal("history")
    // 이미 받아 뒀으면 다시 부르지 않는다. 외출을 새로 수령하면 아래 hearOuting이 비운다
    if (history !== undefined) return
    try {
      const res = await fetch("/api/pet/outing/history")
      const json = await res.json()
      setHistory(res.ok ? (json.data?.items ?? []) : null)
    } catch {
      setHistory(null)
    }
  }

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
  /**
   * 진화 단계가 아직 외출을 못 여는 상태. **화면과 API가 같은 함수를 쓴다**
   * (`lib/pet.ts` `canGoOuting`) — 판정이 두 벌이면 버튼은 열려 있는데 POST가 막힌다.
   *
   * 2026-08-26 사용자 결정: 1단계(알)에서 카드가 **아예 안 보이던 것**을 고쳤다.
   * 전에는 친밀도가 모자라 접히는 규칙에 함께 걸려 사라졌고, 그러면 외출이라는 기능이
   * 있다는 것 자체를 모른 채 알 단계를 보낸다. 지금은 **보이되 잠긴다.**
   */
  const outingLocked = !canGoOuting(pet.evolutionStage)

  /**
   * 아직 못 나가는 두 상태 — 1단계(알)와 친밀도 부족.
   *
   * **둘 다 `disabled`가 아니다.** 눌러야 이유가 나오는 버튼이라 클릭 이벤트가 와야 한다
   * (2026-08-26 사용자 지시: 1단계 제한처럼 친밀도도 눌렀을 때 안내한다).
   * 그래서 이 식에는 **정말 못 누르는 것만** 넣는다 — 요청 진행 중과 외출 중이다.
   *
   * 각주(`Lv.5부터` · `친밀도 200 부족`)는 같은 지시로 **걷었다.** 누르면 나오는 안내와
   * 같은 말이 늘 떠 있는 것은 중복이고, 부족을 반복해서 알리는 것이 이 대상에게 나쁘다.
   */
  const outingCantYet = outingLocked || (outing.state === "IDLE" && outingShort > 0)
  const outingBlocked = pending || away

  // 2026-08-26 개편: 외출 카드가 원형 버튼 하나로 줄었다. **라벨이 상태를 말하므로 팝업을
  // 한 겹 더 두지 않는다** — IDLE에서 "외출 보내기"를 눌러 또 "외출 보내기"가 뜨면 탭이
  // 헛돈다. RETURNED만 모달을 연다(에피소드 세 줄 + 보상 + 수령이 한 화면에 있어야 한다).
  //
  // 2026-08-26(밤) 머지: RETURNED에서 모달을 한 겹 두지 않는다. 여행일기가 종이 시안
  // 팝업이 되면서 `이야기 듣기` → 모달 → `이야기 듣기` 버튼이 두 번이 됐다.
  // 지금은 원형 버튼이 곧바로 hearOuting()을 부르고 그 결과로 일기가 뜬다.
  const outingLabelShort = outingCantYet
    ? "외출 보내기"
    : outing.state === "RETURNED"
      ? "이야기 듣기"
      : away
        ? outingLabel
        : "외출 보내기"

  // 재화 3종. 2026-08-21 사용자 결정으로 셋이 같은 칸을 쓴다 — 전에는 씨앗만 초록, 나머지
  // 둘은 나무색이었다. 색은 종족색 하나로 끝내고 구분은 이모지가 한다
  //
  // 2026-08-24 사용자 요청으로 **순서가 씨앗 → 친밀도 → 별조각**이 됐다(전에는 씨앗 →
  // 별조각 → 친밀도). 이 배열이 화면 순서다 — 아래 렌더가 map만 한다.
  // 친밀도 이모지도 같은 요청으로 💛 → ❤️다("페이지 내의 모든 친밀도"). 노란 하트는
  // 이 카드에서 ⭐·🌱과 같은 노란·연두 계열이라 세 줄이 한 색으로 뭉쳐 보였다
  //
  // 2026-08-25 사용자 요청: 줄을 누르면 **획득 방법과 방법별 상한**을 안내한다.
  // 상한을 여기 적는 이유 — 친밀도에 출처별 상한(챗봇 40 / 커뮤니티 60)이 생겼는데
  // 그 사실을 알 수 있는 자리가 챗봇 패널 안뿐이었다. 재화를 보는 자리에 있어야 한다.
  // 숫자는 전부 상수에서 읽는다. 손으로 적으면 값이 바뀔 때 문구만 낡는다.
  /**
   * 경험치 게이지 노출 (2026-08-26 사용자 결정, 게임 `이환`의 획득 게이지 형태).
   *
   * **상주 → 씨앗 투입 시에만.** 왜 접었나: 펫은 **37단계에서 최종 진화에 닿는다**
   * (단계 미션 씨앗만 셌을 때). 남은 63단계 동안 이 게이지는 움직이지 않는 채 붙어 있다.
   * 안 변하는 게이지는 정보가 아니라 소음이다.
   *
   *   null      숨김
   *   { from }  나타났고, 아직 from 위치를 보여 주는 중 (약 0.3초)
   *             → 그 정지가 "어디서 시작했나"를 알려 준다. 바로 올라가면 증가폭이 안 보인다
   *   { from: null }  올라가는 중 · 끝난 뒤 잠시 유지
   */
  const [expShow, setExpShow] = useState<{ from: number | null } | null>(null)
  const expTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // 진화 단계 팝업. 방 안의 ⓘ 버튼이 연다 (아래 렌더 자리 주석 참고)
  // 조건부로 그리는 모달이므로 열림 상태를 함께 넘긴다(app/components/useModalA11y.ts)

  // 열린 재화 이름. 한 번에 하나만 열린다 — 셋이 다 열리면 카드가 화면을 넘긴다
  const [walletInfo, setWalletInfo] = useState<string | null>(null)

  const wallet = [
    {
      name: "씨앗",
      icon: <CurrencyIcon currency="seed" size={22} />,
      value: pet.seeds,
      use: `펫에게 먹이면 경험치가 돼요 (씨앗 1 = 경험치 ${SEED_TO_EXP})`,
      how: [
        "일일 미션 5개를 다 하면 60",
        "출석은 1~7일차 10·15·20·25·30·35·40 (주 175)",
        `가만히 둬도 시간당 ${IDLE_SEEDS_PER_HOUR}개씩 쌓여요 — ${IDLE_MAX_SEEDS}개까지만 모여요`,
        "단계 미션은 구간이 오를수록 늘어요 (미션당 22~58)",
      ],
      cap: "하루 상한은 없어요. 방치형만 100개에서 멈춰요",
    },
    {
      name: "친밀도",
      icon: <CurrencyIcon currency="affinity" size={22} />,
      value: pet.affinity,
      use: `펫을 밖에 내보내요 (외출 한 번 ${OUTING_COST_AFFINITY})`,
      how: [
        `챗봇과 1턴 대화 +${CHAT_TURN_AFFINITY} — 오늘 최대 ${AFFINITY_CAP_BY_SOURCE.CHAT}`,
        `커뮤니티 글 +${POST_AFFINITY} · 댓글 +${COMMENT_AFFINITY} · 모임 신청 +${MEETUP_JOIN_AFFINITY}`,
        `커뮤니티 세 가지를 합쳐 오늘 최대 ${AFFINITY_CAP_BY_SOURCE.COMMUNITY}`,
      ],
      cap: `하루 최대 ${AFFINITY_DAILY_CAP}. 대화만으로는 다 채울 수 없어요 — 나머지는 사람과 닿는 쪽에서 쌓여요`,
      extra: `${OUTING_COST_AFFINITY}을 모으면 외출 한 번. 돌아올 때 씨앗 ${OUTING_REWARD_MIN}~${OUTING_REWARD_MAX}과 별조각 ${OUTING_REWARD_MIN}~${OUTING_REWARD_MAX}을 가져와요`,
    },
    {
      name: "별조각",
      icon: <CurrencyIcon currency="starShard" size={22} />,
      value: pet.starShards,
      use: `외형 스킨(2,500)과 방 배경(${BACKGROUND_PRICE_SHARDS})을 사요`,
      how: [
        "일일 미션을 **전부** 다 하면 60 (하나라도 빠지면 0)",
        "출석 4일차 5 · 7일차 20 (주 25)",
        "단계 미션은 3구간(문 앞까지)부터 붙어요 — 미션당 1~8",
      ],
      cap: "하루 상한은 없어요",
    },
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

  useEffect(() => {
    if (outing.state !== "RETURNED") {
      setHasSeenReturnPopup(false)
    }
  }, [outing.state])

  function handleAnimEnded() {
    setIsAnimFadingOut(true)
    setTimeout(() => {
      const anim = playingAnimation
      setPlayingAnimation(null)
      setIsAnimFadingOut(false)
      if (anim === "leave") {
        sendOuting()
      } else if (anim === "return") {
        hearOuting()
      }
    }, 300)
  }

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
      setAmount(0)
      setStep(1)
      setToast({ text: `씨앗 ${ko(seeds)}개를 먹였어요. 경험치 +${ko(seeds * SEED_TO_EXP)}` })

      // 경험치 게이지를 띄운다. 순서: 이전 위치로 나타남 → 올라감 → 사라짐.
      // 이전 위치(before)를 먼저 보여 주는 0.3초가 이 연출의 핵심이다 — 그게 없으면
      // 얼마나 늘었는지 알 수 없다. reduced-motion은 CSS가 전환을 끄고 최종값만 남긴다
      expTimers.current.forEach(clearTimeout)
      expTimers.current = []
      setExpShow({ from: expProgress(before.level, before.exp) })
      expTimers.current.push(setTimeout(() => setExpShow({ from: null }), 300))
      expTimers.current.push(setTimeout(() => setExpShow(null), 2600))
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
      // 토스트를 띄우지 않는다 — 아래 여행일기 팝업이 같은 재화를 하단에 담는다
      // 보관함 캐시를 비운다 — 방금 받은 건이 목록의 맨 위여야 한다.
      // null(실패)이 아니라 undefined로 되돌려서 다음에 열 때 다시 부른다
      setHistory(undefined)
      setDiary({
        title: next.title,
        returnedAt: next.returnedAt,
        episode: next.episode,
        gained: next.gained,
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
          {/* 2026-08-26 사용자 요청으로 바꿨다. 전에는 "씨앗을 먹이고 함께 성장하세요"였다 —
              씨앗 투입은 이 화면의 여러 장치 중 하나이고, 친밀도 → 외출 → 이야기가
              이 화면이 실제로 향하는 곳이다(SPEC.md 5절 펫 외출 절) */}
          <p className="pet__lede">친밀도를 올려 펫의 외출 이야기를 들어보세요</p>
        </div>
      </header>

      {/* 2026-08-26 사용자 시안(Figma Make "Reorganize Pet App Layout")으로 개편했다.
          **카드 열이 사라지고 방이 남는 높이를 다 갖는다.** 카드 6장의 내용은 방 안 오버레이
          (경험치 → 좌상단 Lv, 재화 → 상단 알약)와 모달 5개로 옮겼다.

          카드를 **다시 쓰지 않고 옮겨 붙였다** — 아래 모달들의 몸통은 옛 카드 마크업 그대로다.
          그래서 .pet-card·.pet-card--feed·.pet-today·.pet-gauge 규칙이 전부 그대로 살고,
          낙관적 갱신·토스트·3상태 외출 로직은 한 줄도 건드리지 않았다 */}
      <div className="pet-stage">
        <div className="pet-room">
            <PetRoom imageUrl={pet.roomImageUrl} />

            {/* ── 상태판 알약 바 (C의 2026-08-26 시안 · 같은 날 머지에서 채택) ────────
                시안 구성: `( Lv.26 )` `( 게이지 )` … `( 🌱 )( 💗 )( ⭐ )`. 바깥이 알약이고
                안쪽 넷도 각각 알약이며 **테두리 색이 전부 같다**(--pet-chip-ring).

                여기에 내 상단 띠(.pet-topbar — Lv 알약 왼쪽 끝 + 재화 칩 방 정중앙)가
                있었다. 되살릴 값은 pet.css 그 자리 주석에 있다.

                **시안에 없어서 뺀 것 둘**:
                ① 펫 이름 — .pet-char 안 sr-only로 남아 있다
                ② 게이지 안 숫자 — 펫 정보 모달의 "현재 Lv.N · 경험치 X / Y" 줄과 씨앗을
                   넣을 때 뜨는 유리 바(.pet-exp-pop)가 그 값을 말한다. progressbar의 aria
                   값은 그대로다

                오버레이를 방 안에 둔다 — 방 밖으로 내지 않는다(사용자 지시:
                "배경이 좁아지니까 답답함이 느껴짐") */}
            <div className="pet-hud-bar">
              <p className="pet-hud-bar__level">Lv.{pet.level}</p>
              <div
                className="pet-gauge"
                role="progressbar"
                aria-label="다음 레벨까지 경험치"
                aria-valuemin={0}
                aria-valuemax={need}
                aria-valuenow={pet.exp}
              >
                {/* 씨앗을 넣은 직후 0.3초 동안 **이전 위치**를 그린다. 그 뒤 현재 값으로
                    바뀌면 CSS transition(.pet-hud-bar .pet-gauge__fill)이 채워지는 모습을
                    만든다 — JS 애니메이션을 쓰지 않는다.
                    expShow가 null인 평상시에는 그냥 현재 값이라 아무 일도 하지 않는다 */}
                <div
                  className="pet-gauge__fill"
                  style={{ width: `${(expShow?.from ?? progress) * 100}%` }}
                />
              </div>

              {/* 재화 알약 셋. 이름을 sr-only로 남기는 처리는 옛 재화 알약에서 그대로
                  가져왔다 — 시안에는 아이콘과 숫자만 있는데 그렇게만 두면 스크린리더에
                  아무것도 안 남는다 */}
              <ul className="pet-hud-bar__wallet">
                {wallet.map((row) => (
                  <li className="pet-hud-bar__coin" key={row.name}>
                    {/* 2026-08-25 사용자 결정: **칸 전체가 버튼이다.** 지갑 카드가 개편에서
                        사라지면서 재화 안내(획득 방법·하루 상한)를 여는 자리가 없어졌는데,
                        얼마를 어떻게 벌 수 있는지는 이 서비스에서 가장 많이 물어보게 되는
                        것이다. 알약이 그 입구를 물려받는다.
                        C의 시안은 `<li>` 안에 아이콘 + 숫자만 두므로 **모양은 그대로 두고
                        버튼만 안에 넣었다** — 좁은 자리라 ⓘ 표시를 따로 둘 폭이 없고,
                        손가락으로 누르는 화면이라 표적은 칸 전체가 낫다.
                        아이콘은 aria-hidden이고 이름이 sr-only로 남아 있으므로 버튼 이름은
                        "씨앗 3,000"으로 읽힌다 */}
                    <button
                      type="button"
                      className="pet-hud-bar__coin-btn"
                      onClick={() => setWalletInfo(row.name)}
                      aria-haspopup="dialog"
                    >
                      <span className="pet-hud-bar__coin-icon" aria-hidden="true">
                        {row.icon}
                      </span>
                      <span className="sr-only">{row.name}</span>
                      <span className="pet-hud-bar__coin-value">{ko(row.value)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>


            {/* 방 오른쪽 위에 진화 단계를 여는 🌟 버튼이 있었다 — 2026-08-26 사용자 결정으로
                걷었다. C의 개편에서 진화 단계가 **`펫 정보` 모달** 안으로 들어갔고, 입구를
                두 곳에 두지 않는다. 되살릴 값(2rem · top/right --space-2xs · z 2)은
                pet.css의 `.pet-room__evo` 자리 주석에 남겼다 */}


            {/* 경험치 유리 바 — 방 중앙 상단. 씨앗을 넣으면 2.6초 떴다가 스스로 닫힌다.
                **상주 Lv HUD와 함께 나온다**(2026-08-26 사용자 결정). 같은 값이 두 곳에
                보이지만 역할이 다르다: 좌상단 HUD는 **평상시 상태**를, 이 바는 **방금 오른
                몫**을 알린다. 그래서 HUD 게이지의 채움 연출도 그대로 남아 있다.

                한 번 걷었다가 되살린 것이다 — 자리 다섯 번의 내력과 실측(알약 10~44px ·
                HUD 10~98px · 말풍선 322px부터)은 pet.css `.pet-exp-pop` 주석에 있다.

                닫기 버튼이 없다 — 알림이지 대화 상자가 아니다. 그래서 `useModalA11y`를
                쓰지 않는다: 초점을 빼앗으면 먹이기를 연달아 누를 수 없다.
                `role="status"`가 스크린리더에 읽히는 경로다 */}
            {expShow ? (
              <div className="pet-exp-pop" role="status" aria-live="polite">
                <div className="pet-exp-pop__box">
                  <div className="pet-exp-pop__head">
                    {/* 제목 앞 이모지는 2026-08-24 사용자 요청으로 되살린 것이다
                        ("예전에 있던대로"). design.md의 "이모지는 마스코트 자리에만"에서
                        벗어나는 자리다. 새 예외가 아니라 이 화면이 원래 갖고 있던 예외로
                        돌아온 것이고, aria-hidden이라 스크린리더가 읽는 이름은 글자대로다 */}
                    <p className="pet-exp-pop__title">
                      <span aria-hidden="true">⭐</span> 경험치
                    </p>
                    <span className="pet-exp-pop__meta">
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
                    {/* from이 있는 0.3초 동안은 **이전 위치**를 그린다. 그 뒤 현재 값으로
                        바뀌면 CSS transition이 채워지는 모습을 만든다 —
                        JS 애니메이션을 쓰지 않는다 */}
                    <div
                      className="pet-gauge__fill"
                      style={{ width: `${(expShow.from ?? progress) * 100}%` }}
                    />
                  </div>
                  {/* 지금까지 `Lv.25 마지막 진화`만 보여 줬다. 그 문구는 지금 무엇을 얼마나
                      해야 하는지 알려 주지 않는다. 벤치마크한 육성 게임은 전부 남은 개수를
                      쓴다 (2026-08-24 사용자 확정: seedsToNextStage 쪽을 쓴다) */}
                  <p className="pet-exp-pop__foot">
                    <span>현재 Lv.{pet.level}</span>
                    <span>
                      {nextStage
                        ? `${STAGE_NAME[nextStage.stage - 1] ?? `${nextStage.stage}단계`}까지 씨앗 ${ko(nextStage.seeds)}개`
                        : "마지막 단계예요"}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}


            {/* 여기 떠다니는 씨앗 장식 3개(🌱🌿🍃)가 있었다 — 2026-08-24 사용자 요청
                ("주위에 둥둥 떠다니는 이모티콘들 지워줘")으로 걷었다. 펫 주위의 반짝임
                3개(✨⭐✨)도 같은 요청으로 함께 걷었다(아래 .pet-char 주석).
                CSS(.pet-room__seeds·.pet-room__seed)와 petFloatSeed 키프레임도 함께 지웠다.
                방을 채우는 것은 배경 그림과 펫뿐이다 */}

            {/* ── 오른쪽 세로 레일 (2026-08-26 사용자 지시) ──────────────────────────
                `더보기` 안의 다섯을 **펫 옆 빈 밴드**에 세운다. 평소에는 아이콘만이고
                **마우스를 올리면 왼쪽으로 늘어나며 이름이 나온다.**

                ── 왜 `hover: hover`에서만 보이나 ──
                이 방식은 라벨을 hover에 의존한다. **터치에는 hover가 없어서** 이름이
                영원히 안 뜨고, 지금 이모지 4개가 뜻과 어긋나 있어(📊 차트 · 🏪 편의점 ·
                🌟 무의미) 아이콘만으로는 학습성이 성립하지 않는다.
                그래서 **마우스가 있는 기기에서만 레일을 쓰고, 터치에서는 `더보기`를 쓴다.**
                폭(`max-width`)이 아니라 `hover` 능력으로 가르는 것이 요점이다 — 좁은
                데스크톱 창에도 마우스가 있고, 넓은 태블릿에도 없다.
                한 기기에 길은 하나다: 레일이 보이면 `더보기` 알약이 사라진다.

                ── 다른 버튼을 가리지 않는다 ──
                세로로 쌓고 **가로로만** 늘어난다. 형제는 위아래에 있으므로 늘어나도 닿지
                않는다(사용자 조건). 늘어난 폭은 128px로 묶었다 — 넓은 화면에서 펫 오른쪽
                빈 밴드가 132px이라 그 안에 들어간다.

                `:focus-visible`도 같이 늘린다. 키보드로 넘어가는 사람에게 hover가 없다 */}
            <div className="pet-rail">
              {[
                outing.available
                  ? { icon: <PetIcon name="diary" />, label: "여행일기", go: openHistory, on: modal === "history" }
                  : null,
                { icon: <PetIcon name="chart" />, label: "오늘의 활동", go: () => setModal("today"), on: modal === "today" },
                { icon: <PetIcon name="shop" />, label: "상점", go: () => router.push("/pet/shop"), on: false },
                { icon: <PetIcon name="info" />, label: "펫 정보", go: () => setModal("info"), on: modal === "info" },
              ]
                // `filter` + 타입 술어였다. 아이콘이 이모지 문자열에서 JSX로 바뀌면서 술어에
                // 적을 타입이 `JSX.Element`가 되고, 그러면 아이콘을 바꿀 때마다 이 줄도 같이
                // 고쳐야 한다. `flatMap`은 타입을 적지 않고 같은 좁히기를 한다
                .flatMap((r) => (r ? [r] : []))
                .map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    className="pet-rail__btn"
                    onClick={r.go}
                    data-active={r.on ? "true" : undefined}
                  >
                    {/* **아이콘이 DOM에서 먼저다.** `flex-direction: row-reverse`가
                        첫 자식을 오른쪽 끝에 두므로, 라벨을 먼저 두면 라벨이 오른쪽으로
                        자라 방 밖으로 잘렸다(2026-08-26 사용자 지적). 순서를 바꿔서
                        아이콘이 오른쪽에 고정되고 라벨이 **왼쪽으로** 자란다.

                        라벨을 aria에서 숨기지 않는다 — 스크린리더에는 늘 읽혀야 하고
                        눈에만 접혀 있다 */}
                    <span className="pet-rail__icon" aria-hidden="true">
                      {r.icon}
                    </span>
                    <span className="pet-rail__label">{r.label}</span>
                  </button>
                ))}
            </div>

            {/* ── 방 안 하단 액션 바 (2026-08-26 사용자 지시) ────────────────────────
                **버튼을 방 밖으로 내지 않는다** — 배경이 좁아져 답답해진다는 지적이었다.
                그래서 방 안에 두면서 펫을 가리지 않을 만큼 작게 만든다.

                ── 왜 2개 + 더보기인가 (UI/UX 원칙 4개 기준) ──
                **직관성** 주 동작 둘은 글자로 무엇인지 말한다. 아이콘만 두면 지금 이모지
                        (📊 차트 · 🏪 편의점 · 🌟 무의미)로는 뜻이 전달되지 않는다
                **유효성** 이 화면에 온 목적이 먹이기와 외출이다. 그 둘은 한 번에 닿는다
                **학습성** 나머지 다섯은 `더보기` 안에서 **아이콘 + 이름 + 한 줄 설명**으로
                        보인다 — 원형 버튼 7개를 늘어놓는 것보다 처음 온 사람에게 낫다
                **유연성** 못 하는 상태(1단계·친밀도 부족)에서도 눌리고 이유를 말한다.
                        틀린 것을 막는 대신 왜 안 되는지 알린다

                `더보기`에 점 세 개만 두지 않고 **글자를 붙였다** — 아이콘만이면 무엇이
                열리는지 배울 길이 없다(학습성).

                띠는 반투명 카드색 + blur다. 배경 6종 위에서 대비가 확보된 값이고
                (재화 띠와 같은 값), 방 아래쪽 여백에 앉아 펫 발치만 지난다 */}
            <div className="pet-acts">
              <button
                type="button"
                className="pet-act pet-act--primary"
                onClick={() => {
                  setAmount(0)
                  setStep(1)
                  setModal("seed")
                }}
                aria-haspopup="dialog"
              >
                <PetIcon name="seed" /> 씨앗 먹이기
              </button>
              {/* available: false면 버튼이 아예 없다. 마이그레이션(PetOuting)이 안 들어간
                  DB에서 lib/outing.ts가 그렇게 내려보낸다 — 없는 기능을 광고하지 않는다 */}
              {outing.available ? (
                <button
                  type="button"
                  className="pet-act pet-act--primary"
                  data-cant={outingCantYet ? "" : undefined}
                  disabled={outingBlocked}
                  onClick={() => {
                    // 못 나가는 두 상태는 요청을 보내지 않고 이유만 알린다(유연성)
                    if (outingLocked) setToast({ text: OUTING_LOCK_MESSAGE })
                    else if (outing.state === "RETURNED") setPlayingAnimation("return")
                    else if (outingShort > 0)
                      setToast({ text: outingNeedAffinityMessage(outingShort) })
                    else setPlayingAnimation("leave")
                  }}
                >
                  <PetIcon name={outingCantYet ? "lock" : "outing"} /> {outingLabelShort}
                </button>
              ) : null}
              <button
                type="button"
                className="pet-act pet-act--more"
                onClick={() => setModal("menu")}
                aria-haspopup="dialog"
              >
                <PetIcon name="menu" /> 더보기
              </button>
            </div>

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
                {/* 손으로 찢어 낸 쪽지 (2026-08-26 사용자 제공 이미지 기준).
                    전에는 네 변이 완만한 곡선(C)이라 모서리 둥근 카드로 읽혔다. 지금은
                    직선 조각(L)으로 톱니를 만든다 — 찢어진 종이의 결은 곡선이 아니다.
                    **viewBox를 260×130으로 둔 이유**: 쪽지 실치수가 19 × 9.5rem = 2:1이라
                    preserveAspectRatio="none"의 늘어남이 기본 크기에서 거의 0이다.
                    좌우 톱니는 세로 방향이라 가로로 늘어나도 결이 뭉개지지 않는다.
                    면은 카드색을 그대로 쓴다 — 배경 그림 6종 위에서 글자 명암비를 지키는
                    유일한 색이고, 제공된 이미지의 크림색과도 육안차가 없다 */}
                <svg
                  className="pet-away__paper"
                  viewBox="0 0 260 130"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    vectorEffect="non-scaling-stroke"
                    d="M9 11L30 8L52 12L74 8L96 11L118 7L140 11L162 8L184 12L206 8L228 11L251 8L253 26L248 44L253 62L249 80L254 98L250 116L251 123L228 121L206 124L184 120L162 123L140 119L118 123L96 120L74 124L52 120L30 123L9 120L5 102L10 84L6 66L11 48L6 30Z"
                  />
                </svg>
                {/* 종이를 벽에 붙인 노란 테이프. 제공된 이미지의 핵심 요소다 —
                    이것이 있어야 "바닥에 놓인 종이"가 아니라 "붙여 둔 쪽지"로 읽힌다.
                    끝을 톱니로 만든다(손으로 끊은 마스킹 테이프). 이쪽은 늘어나지 않으므로
                    preserveAspectRatio를 기본값으로 두고 비율을 지킨다 */}
                <svg className="pet-away__tape" viewBox="0 0 72 27" aria-hidden="true">
                  <path d="M4 7L9 5L20 4L34 3.5L48 3L62 2.5L68 4L64 8L70 12L65 16L69 21L62 23L48 23.5L34 24L20 24.5L10 25L5 23L9 19L3 15L8 11Z" />
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

            {/* ── 방 안 오버레이 (2026-08-26 시안) ────────────────────────────────
                오버레이를 방의 **마지막 자식**으로 둔다. 방 배경 SVG가 첫 자식이라
                DOM 순서만으로도 위에 그려지고, .pet-room이 overflow: hidden이라
                어느 폭에서도 방 밖으로 새지 않는다 */}


          </div>


        {/* ── 모달 5개 ───────────────────────────────────────────────────────────
            몸통은 옛 카드 마크업 그대로다. 껍데기(.pet-modal)만 새로 만들었고
            Esc·초점 트랩·배경 스크롤 잠금은 useModalA11y()가 이미 갖고 있다 */}

        {/* 여기에 **외출 RETURNED 전용 모달**이 있었다(C, 2026-08-26). 에피소드를 미리
            보여 주고 `이야기 듣기`로 수령하는 두 단계였다. 같은 날 밤 머지에서 걷었다 —
            여행일기가 사용자 시안(종이 한 장) 팝업이 되면서 두 화면이 같은 자리를 다퉜고,
            `이야기 듣기` 버튼이 원형 버튼과 모달에 두 번 있었다.
            지금은 원형 버튼이 곧바로 hearOuting()을 부르고 그 응답으로 종이 일기가 뜬다
            (아래 diary). 단계가 하나 줄었고 에피소드는 일기 안에서만 보인다 —
            **미리 다 보여 주면 누를 이유가 사라진다**는 판단은 그대로다 */}

        {/* 여기에 **"🍎 경험치" 카드**가 있었다 — 제목 줄 + .pet-gauge + 각주(현재 Lv / 다음
            단계까지 씨앗 N개) 세 줄이었다. **2026-08-26 개편으로 방 안 좌상단 오버레이
            (.pet-hud-bar)가 됐다.** 게이지는 같은 .pet-gauge 클래스를 그대로 쓰고, 각주는
            펫 정보 모달로 갔다(오버레이는 두 줄이어야 한다 — 그 자리 주석 참고) */}

        {/* 펫 정보 — 시안에 자리가 없던 것 셋을 모았다 (2026-08-26 사용자 결정).
            그동안 쌓인 씨앗(방치형 수확) · 진화 단계 4칸 · 잠깐 쉬어 가기.
            지난 외출 이야기와 진화 임박 각주도 여기 있다 — 넷 다 "지금 하는 것"이 아니라
            "지금 어떤 상태인가"라서 한 모달에 들어간다 */}
        {modal === "info" ? (
          <PetModal title="펫 정보" onClose={closeModal} wide>
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

            {/* 지난 외출 이야기. 옛 외출 카드의 IDLE 상태가 갖고 있던 것이다(story) —
                수령한 뒤에도 다음 외출을 보낼 때까지 남는다. --past는 글자를 흐리게 하는
                변형이고 "지금 일이 아니라 지난 일"이라는 표시다 */}
            {story.length > 0 ? (
              <div className="pet-card">
                <p className="pet-card__title">
                  <span aria-hidden="true">🚪</span> 지난 외출 이야기
                </p>
                <ul className="pet-story pet-story--past">
                  {story.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

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

            {/* 옛 "🍎 경험치" 카드의 각주다. 상태판 알약 바(.pet-hud-bar)는 Lv과 게이지만
                갖고 이 문장은 여기로 왔다 — "다음 단계까지 씨앗 N개"는 진화 4칸 바로 옆에서
                읽는 것이 맞고, 오버레이에 세 번째 줄을 붙이면 방 위 글자가 늘어난다 */}
            <p className="pet-card__foot">
              <span>현재 Lv.{pet.level}</span>
              <span>
                {nextStage
                  ? `${STAGE_NAME[nextStage.stage - 1] ?? `${nextStage.stage}단계`}까지 씨앗 ${ko(nextStage.seeds)}개`
                  : "마지막 단계예요"}
              </span>
            </p>

            {/* 쉬는 화면(/pet/rest) 입구. 상단 나무판을 걷으면서 유일한 입구가 사라졌다.
                각주 크기로 화면 맨 아래에 둔다(2026-08-24 결정) — 홈·미션에서 링크하지 않는
                이유와 같다. 쉬는 화면을 눈에 띄는 자리에서 권하면 "쉬어라"는 지시가 된다.
                찾아온 사람만 닿으면 되고, 여기 있다는 사실만 남으면 된다 */}
            <p className="pet__rest">
              <Link href="/pet/rest">잠깐 쉬어 가기</Link>
            </p>
          </PetModal>
        ) : null}

        {/* 씨앗 투입 — 시안의 바텀시트 자리다. 카드 몸통을 그대로 넣었으므로 스테퍼·프리셋
            4개·먹이기 버튼과 낙관적 갱신이 전부 그대로 돈다 */}
        {modal === "seed" ? (
          <PetModal title="씨앗 투입" onClose={closeModal}>

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
                    onClick={() => setAmount((a) => Math.max(0, a - step))}
                    disabled={amount - step < 0}
                    aria-label={`${step}개 줄이기`}
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
                    onClick={() => setAmount((a) => Math.min(pet.seeds, a + step))}
                    disabled={amount + step > pet.seeds}
                    aria-label={`${step}개 늘리기`}
                  >
                    +
                  </button>
                </div>

                <div className="pet-presets">
                  {FEED_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="pet-preset"
                      data-active={step === p ? "true" : undefined}
                      aria-label={`증감 단위 ${ko(p)}개로 설정`}
                      onClick={() => setStep(p)}
                    >
                      {ko(p)}개
                    </button>
                  ))}
                </div>

                {/* 투입할 개수가 정해지면 그것이 무엇이 되는지 바로 옆에서 말한다.
                    "씨앗 1개는 경험치 10"만으로는 100개를 넣기 전에 곱셈을 시켜야 했다 */}
                <p className="pet-card__foot">
                  <span>씨앗 1개는 경험치 {SEED_TO_EXP}이 돼요</span>
                  <em>경험치 +{ko(feedable * SEED_TO_EXP)}</em>
                </p>

                <button
                  type="button"
                  className="pet-btn pet-btn--block"
                  onClick={() => feed(feedable)}
                  disabled={pending || amount > pet.seeds || amount <= 0}
                  aria-disabled={pending || amount > pet.seeds || amount <= 0}
                >
                  먹이기
                </button>
              </>
            )}
          </div>
          </PetModal>
        ) : null}

          {/* develop의 "📖 함께한 기록" 카드(함께한 날 · 해낸 미션 · 출석)가 여기 있었다.
              **2026-08-24 병합에서 사용자 결정으로 가져오지 않았다.** 그 카드의 출석 칸이
              아래 "오늘의 활동" 네 번째 칸(같은 user.attendanceTotal)과 같은 수를 한 화면에
              두 번 보여 주게 되고, 두 카드 중 하나를 고르는 자리에서 오늘의 활동 쪽이
              같은 날 사용자 요청으로 만들어진 것이다.
              데이터는 그대로 내려온다 — PetState의 daysTogether·missionsDone·attendanceTotal은
              app/pet/page.tsx가 계속 채우고, pet.css의 .pet-log 규칙도 남아 있다.
              되살릴 일이 생기면 그 두 벌이 이미 있으므로 이 자리에 카드만 다시 세우면 된다 */}

        {/* ── 더보기 (2026-08-26 사용자 지시) ─────────────────────────────────────
            방 안 액션 바에 두지 못한 다섯을 모았다. **원형 버튼을 늘어놓는 것보다 낫다**고
            본 이유가 학습성이다 — 여기서는 아이콘 옆에 **이름과 한 줄 설명**이 함께 온다.
            처음 온 사람이 `📊`를 보고 무엇인지 짐작해야 하는 것과, `오늘의 활동 — 오늘 들어온
            재화를 봐요`를 읽는 것은 다르다.

            순서는 "방금 것"에서 "전체"로 간다. 마음 친구가 마지막인 것은 이 화면의 일이
            아니라 다른 기능으로 가는 문이기 때문이다 */}
        {modal === "menu" ? (
          <PetModal title="더보기" onClose={closeModal}>
            <p className="pet-card__title">
              <PetIcon name="menu" /> 더보기
            </p>
            <ul className="pet-menu">
              {[
                outing.available
                  ? { icon: <PetIcon name="diary" />, label: "여행일기", desc: "다녀온 이야기를 다시 읽어요", go: openHistory }
                  : null,
                { icon: <PetIcon name="chart" />, label: "오늘의 활동", desc: "오늘 들어온 재화를 봐요", go: () => setModal("today") },
                { icon: <PetIcon name="shop" />, label: "상점", desc: "외형과 배경을 바꿔요", go: () => router.push("/pet/shop") },
                { icon: <PetIcon name="info" />, label: "펫 정보", desc: "자라는 단계와 쌓인 씨앗을 봐요", go: () => setModal("info") },
              ]
                // 타입을 적지 않고 null을 걷는다 — 위 레일의 그 자리 주석과 같은 이유다
                .flatMap((r) => (r ? [r] : []))
                .map((r) => (
                  <li key={r.label}>
                    {/* 줄 전체가 버튼이다 — 손가락으로 누르는 화면이라 표적이 클수록 낫다
                        (재화 띠·보관함 목록과 같은 판단) */}
                    <button type="button" className="pet-menu__row" onClick={r.go}>
                      <span className="pet-menu__icon" aria-hidden="true">
                        {r.icon}
                      </span>
                      <span className="pet-menu__body">
                        <span className="pet-menu__label">{r.label}</span>
                        <span className="pet-menu__desc">{r.desc}</span>
                      </span>
                      <span className="pet-menu__caret" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </PetModal>
        ) : null}

        {/* 여행일기 보관함 — 목록 (2026-08-26 사용자 요청).
            `보관함 → 목록 → 일기` 세 단계다. 여기서 한 줄을 누르면 같은 종이 일기가
            **읽기 전용**으로 열린다(아래 historyPick).

            최근 10건만 본다(OUTING_HISTORY_LIMIT). 하루 최대 2회니까 약 5일치다 —
            그보다 길게 두면 스크롤이 기억을 대신하지 못한다. "더 보기"를 두지 않은 것은
            이 목록이 성취 기록이 아니라 *방금 것을 다시 찾는 자리*이기 때문이다.

            아직 안 받은 건은 목록에 없다(서버가 claimedAt으로 걸러 준다) — 보관함에서
            먼저 읽히면 누르기 전에 다 보여 주는 것이 된다 */}
        {modal === "history" ? (
          <PetModal title="여행일기" onClose={closeModal}>
            <p className="pet-card__title">
              <span aria-hidden="true">📖</span> 여행일기
            </p>
            {history === undefined ? (
              // 읽는 중과 실패를 가른다 — 하나로 합치면 여는 순간 "기록이 없어요"가 깜빡인다
              <p className="pet-history__note">불러오는 중이에요</p>
            ) : history === null ? (
              <p className="pet-history__note">기록을 불러오지 못했어요. 잠시 후 다시 열어 주세요</p>
            ) : history.length === 0 ? (
              <p className="pet-history__note">
                아직 다녀온 기록이 없어요. 외출을 한 번 보내면 여기에 남아요
              </p>
            ) : (
              <ul className="pet-history">
                {history.map((h) => (
                  <li key={h.id}>
                    {/* 줄 전체가 버튼이다 — 손가락으로 누르는 화면이라 표적이 클수록 낫다
                        (옛 지갑 줄·재화 알약과 같은 판단) */}
                    <button
                      type="button"
                      className="pet-history__row"
                      onClick={() => setHistoryPick(h)}
                      aria-haspopup="dialog"
                    >
                      <span className="pet-history__date">{historyDate(h.returnedAt)}</span>
                      <span className="pet-history__title">{h.title}</span>
                      <span className="pet-history__loot">
                        <CurrencyIcon currency="seed" size={14} /> {ko(h.gained.seeds)}
                        <CurrencyIcon currency="starShard" size={14} /> {ko(h.gained.starShards)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* 개수를 적어 둔다 — 10건이 상한이라는 것을 모르면 옛 기록이 사라진 것으로 읽힌다 */}
            {history && history.length > 0 ? (
              <p className="pet-history__foot">최근 {ko(OUTING_HISTORY_LIMIT)}건까지 남아요</p>
            ) : null}
          </PetModal>
        ) : null}

        {modal === "today" ? (
          <PetModal title="오늘의 활동" onClose={closeModal}>
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
              <span aria-hidden="true">📊</span> 오늘 들어온 것
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
          </PetModal>
        ) : null}




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

      {walletInfo ? (
        <WalletInfoModal
          row={wallet.find((r) => r.name === walletInfo)!}
          onClose={() => setWalletInfo(null)}
        />
      ) : null}

      {diary ? (
        <OutingDiaryModal
          skinName={pet.skinName}
          title={diary.title}
          returnedAt={diary.returnedAt}
          episode={diary.episode}
          gained={diary.gained}
          onClose={() => setDiary(null)}
        />
      ) : null}

      {/* 보관함에서 고른 옛 일기. **같은 컴포넌트를 읽기 전용으로 쓴다** — 종이 시안을
          두 벌로 만들면 한쪽만 고쳐진다. 다른 것은 맨 아래 버튼뿐이다:
          방금 받은 일기는 `{펫} 맞이하기`(만나러 간다), 옛 일기는 `닫기`다.
          `맞이하기`를 옛 기록에 두면 재화를 또 받는 것처럼 읽힌다 */}
      {historyPick ? (
        <OutingDiaryModal
          skinName={pet.skinName}
          title={historyPick.title}
          returnedAt={historyPick.returnedAt}
          episode={historyPick.episode}
          gained={historyPick.gained}
          readOnly
          onClose={() => setHistoryPick(null)}
        />
      ) : null}
      {/* **`.pet-stage`가 여기서 닫힌다** (2026-08-26 사용자 지시로 옮겼다).
          전에는 방 바로 뒤에서 닫혔고 모달·팝업이 그 밖(`<main>`)에 있었다. 그러면
          `position: fixed`가 **뷰포트** 기준이라 씨앗 투입 창이 화면 가운데에 뜨고,
          방 위쪽의 경험치 게이지를 덮었다.

          스테이지 안으로 들이면 `position: absolute`가 **스테이지 = 방 사각형** 기준이
          된다(그 등식은 `.pet-stage` 주석의 근거다). 절대 위치 자식은 흐름에서 빠지므로
          스테이지의 flex 레이아웃에는 아무 영향이 없다.

          토스트는 그대로 `fixed`다 — 화면 아래 가운데가 그 관습이고, 방을 벗어나야 한다 */}
      {playingAnimation ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 400,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: isAnimFadingOut ? 0 : 1,
            transition: "opacity 0.3s ease-in-out"
          }}
        >
          <video
            autoPlay
            playsInline
            muted
            src={cdnUrl(`pets/${pet.typeCode === "HEALTH_EMOTION" ? "fox" : pet.typeCode === "INDEPENDENT_LOW_INCOME" ? "cat" : "bear"}_${playingAnimation}.webm`) || undefined}
            onEnded={handleAnimEnded}
            onError={handleAnimEnded}
            style={{ maxWidth: "100%", maxHeight: "100%" }}
          />
        </div>
      ) : null}

      {outing.state === "RETURNED" && !hasSeenReturnPopup ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 350,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
          onClick={() => setHasSeenReturnPopup(true)}
        >
          <div
            className="pet-card"
            style={{ textAlign: "center", padding: "2rem", maxWidth: "80%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              펫이 무사히 복귀했어요!<br />
              여행 결과를 확인해 보세요.
            </p>
            <button
              type="button"
              className="pet-btn pet-btn--block"
              onClick={() => setHasSeenReturnPopup(true)}
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </main>
  )
}

/**
 * 재화 안내 팝업. 지갑 줄을 누르면 뜬다(2026-08-25 사용자 결정).
 *
 * 확장식이 아닌 이유는 지갑 줄 렌더 자리의 주석에 있다 — 열이 좁아 글이 끊기고
 * 카드가 상점 입구를 밀어낸다.
 *
 * Escape·초점 가두기·닫을 때 초점 되돌리기는 `useModalA11y`가 한다. 이 앱의 다른
 * 모달 네 개(미션 상세·글쓰기·글 상세·내 계정)와 같은 훅이다 — 규칙을 두 벌로 만들지 않는다.
 */
function WalletInfoModal({
  row,
  onClose,
}: {
  row: { name: string; icon: ReactNode; use: string; how: string[]; cap: string; extra?: string }
  onClose: () => void
}) {
  const boxRef = useModalA11y(onClose)
  const titleId = `wallet-info-${row.name}`

  return (
    <div className="pet-wallet-pop" onClick={onClose}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="pet-wallet-pop__box screen-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pet-wallet-pop__head">
          <p className="pet-wallet-pop__title" id={titleId}>
            <span aria-hidden="true">{row.icon}</span> {row.name}
          </p>
          <button
            type="button"
            className="pet-wallet-pop__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <p className="pet-wallet-pop__use">{row.use}</p>

        <p className="pet-wallet-pop__head-label">이렇게 모아요</p>
        <ul className="pet-wallet-pop__list">
          {row.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {row.extra ? <p className="pet-wallet-pop__extra">{row.extra}</p> : null}

        <p className="pet-wallet-pop__cap">{row.cap}</p>
      </div>
    </div>
  )
}

/**
 * 여행일기 팝업.
 *
 * 2026-08-26 사용자가 준 화면 시안에 맞춰 다시 짰다. 시안은 **종이 한 장**이다 —
 * 마스킹 테이프 두 조각, 클립, 겹친 종이 그림자, 점선 구분선, 형광펜 밑줄.
 *
 * 앞 판(펫 초상 상단 + 이야기 중단 + 재화 하단, 넓은 화면 2단)에서 바뀐 것 4개:
 *   ① 펫 초상이 빠지고 그 자리에 발자국 + 날짜 + 제목이 온다 (시안에 초상이 없다)
 *   ② 본문 위에 **제목 한 줄**이 생겼다 — 서버가 저장된 legs에서 계산해 준다
 *   ③ 재화가 줄 목록에서 **선물 타일**이 됐다(그림 + 수량 배지 + 이름)
 *   ④ 닫기 버튼이 `{펫 이름} 맞이하기`가 됐다 — 끝내는 말이 아니라 만나러 가는 말이다
 *
 * **시안의 세 번째 선물(쿠키 조각)은 넣지 않았다.** 우리 경제에 없는 재화다 —
 * 만들려면 스키마와 `calculateReward()`를 함께 고쳐야 하고 그건 전원 합의 사항이다
 * (`CLAUDE.md` 1·2절). 시안의 `친밀도 +3`도 넣지 않았다: 외출은 친밀도를 **쓴다**(200).
 * "가져온 선물"에 쓴 재화를 놓으면 거짓이 된다. 그래서 타일은 씨앗·별조각 둘이다.
 *
 * 넓은 화면 2단 배치는 걷었다. 시안이 세로로 긴 종이 한 장이라 두 규칙이 서로 싸운다.
 */
function OutingDiaryModal({
  skinName,
  title,
  returnedAt,
  episode,
  gained,
  readOnly,
  onClose,
}: {
  skinName: string
  title: string
  returnedAt: string
  episode: string[]
  gained: { seeds: number; starShards: number }
  /**
   * 보관함에서 옛 일기를 볼 때 true (2026-08-26). **바뀌는 것은 맨 아래 버튼 하나다** —
   * `{펫} 맞이하기`는 방금 돌아온 펫을 만나러 가는 말이고, 옛 기록에 그 버튼을 두면
   * 재화를 또 받는 것처럼 읽힌다. 재화 지급 경로는 `POST /claim` 하나뿐이다.
   */
  readOnly?: boolean
  onClose: () => void
}) {
  const boxRef = useModalA11y(onClose)

  // `2026. 08. 26`. toLocaleDateString을 쓰지 않는다 — 로케일에 따라 `2026/8/26`이나
  // `26. 8. 26.`이 나와 시안의 자리 폭이 흔들린다. ISO에서 직접 자른다.
  const d = new Date(returnedAt)
  const dateLabel = Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}`

  const gifts = [
    { key: "seed", currency: "seed" as const, label: "씨앗", amount: gained.seeds, badge: `x${ko(gained.seeds)}` },
    {
      key: "shard",
      currency: "starShard" as const,
      label: "별조각",
      amount: gained.starShards,
      badge: `x${ko(gained.starShards)}`,
    },
  ]

  return (
    <div className="pet-diary-pop" onClick={onClose}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diary-title"
        tabIndex={-1}
        className="pet-diary-pop__box pet-diary-pop__box--diary screen-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 종이 장식. 전부 aria-hidden이다 — 스크린리더에 읽을 내용이 없다.
            테이프·클립·겹친 종이는 이미지가 아니라 CSS 도형이다(새 에셋을 넣지 않았다) */}
        <span className="pet-diary__clip" aria-hidden="true" />
        <span className="pet-diary__tape pet-diary__tape--tl" aria-hidden="true" />
        <span className="pet-diary__tape pet-diary__tape--br" aria-hidden="true" />
        <span className="pet-diary__dots" aria-hidden="true" />

        {/* 닫기는 오른쪽 위 하나다. 맨 아래 `맞이하기` 버튼도 같은 onClose를 부르는데,
            둘을 둔 것은 시안 그대로다 — 위는 그만 보기, 아래는 다 읽고 나가기다 */}
        <button
          type="button"
          className="pet-diary__x"
          onClick={onClose}
          aria-label="여행일기 닫기"
        >
          ✕
        </button>

        <div className="pet-diary__head">
          <span className="pet-diary__paw" aria-hidden="true">
            🐾
          </span>
          {dateLabel ? (
            <p className="pet-diary__date">
              <span aria-hidden="true" className="pet-diary__date-rule" />
              <time dateTime={returnedAt}>{dateLabel}</time>
              <span aria-hidden="true" className="pet-diary__date-rule" />
            </p>
          ) : null}
          {/* 제목에 형광펜 밑줄이 깔린다. text-decoration이 아니라 배경 그라디언트다 —
              밑줄은 글자에 붙지만 형광펜은 글자를 가로지르며 조금 넘쳐야 한다 */}
          <h2 className="pet-diary__name" id="diary-title">
            {skinName}의 외출 이야기
          </h2>
        </div>

        <span className="pet-diary__rule" aria-hidden="true" />

        {/* 제목 양옆 반짝임 세 줄. ✨ 이모지가 아니라 CSS 선이다 — 이모지는 폰트마다
            크기가 달라 좌우 대칭이 깨진다 */}
        <p className="pet-diary__lead">
          <span className="pet-diary__spark pet-diary__spark--l" aria-hidden="true" />
          <span className="pet-diary__lead-text">{title}</span>
          <span className="pet-diary__spark pet-diary__spark--r" aria-hidden="true" />
        </p>

        {/* 본문. 5축 일기가 최대 11줄이라 여기만 스크롤한다 — 종이 높이가 화면을 넘지
            않아야 하고, 위 제목과 아래 선물은 늘 보여야 한다. 불릿을 쓰지 않는다(글이다) */}
        <ul className="pet-diary__story">
          {episode.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>

        <span className="pet-diary__rule" aria-hidden="true" />

        {/* 실지급액이다(서버가 calculateReward()를 통과시킨 값). 0이어도 칸을 지우지 않는다 —
            "여기에 재화가 들어온다"는 자리로 읽히는 편이 낫다(지갑 카드와 같은 판단) */}
        <p className="pet-diary__gift-head">
          <span aria-hidden="true" className="pet-diary__gift-rule" />
          <span className="pet-diary__gift-chip">가져온 선물</span>
          <span aria-hidden="true" className="pet-diary__gift-rule" />
        </p>
        <ul className="pet-diary__gifts">
          {gifts.map((g) => (
            <li key={g.key} className="pet-diary__gift">
              <span className="pet-diary__gift-art">
                <CurrencyIcon currency={g.currency} size={56} />
                <span className="pet-diary__gift-badge" aria-hidden="true">
                  {g.badge}
                </span>
              </span>
              <span className="pet-diary__gift-name">
                {g.label} {g.badge}
              </span>
            </li>
          ))}
        </ul>

        <button type="button" className="pet-btn pet-diary__go" onClick={onClose}>
          {readOnly ? (
            "닫기"
          ) : (
            <>
              <span aria-hidden="true">🐾</span> {skinName} 맞이하기{" "}
              <span aria-hidden="true">🐾</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// 여기에 **CircleBtn**(원형 조작 버튼)이 있었다 — C의 2026-08-26 시안이 방 좌우에 세운
// 아이콘 원 + 라벨 알약 구조다. 같은 날 사용자 지시로 화면이 두 번 더 바뀌면서 걷혔다:
//   ① 좌우 스택 10개 → 방 아래 하단 독 7개(무게 3단)
//   ② 방 아래 독 → **방 안** 액션 바 2개 + `☰ 더보기`
// ②의 이유는 "배경이 좁아지니까 답답함이 느껴짐"이었다. 방 안에 두려면 발자국이 작아야
// 하고, 원 + 라벨 구조는 한 버튼이 약 68px이라 일곱이 들어가지 않았다.
//
// 되살릴 값: 아이콘 원 3rem(main 4 / sub 2.5 / chat 3.25rem) · radius --radius-pill ·
// 면 var(--pet-gloss) + linear-gradient(135deg, --tribe-face, --tribe) ·
// 라벨 --text-label 600 · href 유무로 <Link>/<button>을 가르는 구조 ·
// locked prop(disabled가 아니라 눌리되 안내만 하는 상태). 전부 git 이력에 있다.

// ── 모달 껍데기 ────────────────────────────────────────────────────────────────
//
// Esc·초점 트랩·배경 스크롤 잠금·닫을 때 초점 복귀는 **useModalA11y()가 이미 갖고 있다**
// (app/components/useModalA11y.ts). 이 앱의 다른 모달 세 개(미션 상세·내 계정·챗봇 패널)가
// 같은 훅을 쓰므로 여기서 규칙을 새로 만들지 않는다.
//
// ref는 **내용 div**에 붙인다(배경 스크림이 아니다) — 그 훅 주석의 요구다.
//
// wide는 진화 단계 4칸이 들어가는 펫 정보 모달 하나만 쓴다. 4칸이 기본 폭에서
// 두 줄로 접히는데, 그러면 "1 → 2 → 3 → 4" 순서가 눈에 한 줄로 안 들어온다.
function PetModal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string
  onClose: () => void
  wide?: boolean
  children: React.ReactNode
}) {
  const ref = useModalA11y(onClose)

  return (
    <div className="pet-modal">
      {/* 배경을 눌러도 닫힌다. Esc와 ✕에 더해 세 번째 길이고, 모달 밖을 누르는 것이
          "닫기"라는 기대는 이 앱의 다른 모달들과 같다 */}
      <div className="pet-modal__scrim" onClick={onClose} />
      <div className="pet-modal__box" ref={ref} role="dialog" aria-modal="true" aria-label={title} data-wide={wide ? "true" : undefined}>
        <button type="button" className="pet-modal__close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
