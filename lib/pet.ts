import type { Rarity, Slot } from "@prisma/client"
import { EVOLUTION_LEVEL, SEED_TO_EXP, TRIBE, evolutionStageFor, expToNextLevel } from "@/lib/types"

// 소유자: C. 펫 성장 계산. 순수 함수만 둔다 (DB·요청 객체를 모르게 유지해야 체크 스크립트로 검증된다).
// 수치 근거는 SPEC.md 5절. 곡선 상수는 lib/types.ts(A 소유)에 있으므로 여기서 다시 정의하지 않는다.
// 로직을 고쳤으면 npm run check:pet 을 돌린다.

export type Growth = {
  level: number
  exp: number
  evolutionStage: number
}

export type GrowthResult = Growth & {
  /** 이번 투입으로 오른 레벨 수. 0이면 레벨업 없음 */
  gainedLevels: number
  /** 진화 연출을 띄울 단계. 단계가 올라가지 않았으면 null */
  evolvedTo: number | null
}

/**
 * 진화 단계는 레벨로 정해지지만 스킨이 가진 단계 수를 넘지 못한다.
 * 지금 스킨은 전부 stageCount = 4이지만(외형만 바뀐다. SPEC.md 5절), 단계 수가 다른
 * 스킨이 들어와도 저장값이 stageCount를 넘지 않게 여기서 자른다.
 */
export function cappedStage(level: number, stageCount: number): number {
  return Math.min(evolutionStageFor(level), Math.max(1, stageCount))
}

/**
 * 씨앗을 경험치로 넣은 뒤의 성장 상태를 계산한다.
 * 씨앗을 몰아서 넣으면 레벨이 여러 개 한꺼번에 오를 수 있어 while로 처리한다.
 *
 * 씨앗 차감은 이 함수가 하지 않는다. 호출부가 트랜잭션 안에서 함께 처리한다.
 */
export function applySeeds(current: Growth, seeds: number, stageCount = 4): GrowthResult {
  // level이 0 이하로 들어오면 expToNextLevel이 0이 되어 while이 끝나지 않는다.
  const startLevel = Math.max(1, Math.floor(current.level))
  const startExp = Math.max(0, Math.floor(current.exp))
  const add = Math.floor(seeds) * SEED_TO_EXP

  if (add <= 0) {
    return {
      level: startLevel,
      exp: startExp,
      evolutionStage: cappedStage(startLevel, stageCount),
      gainedLevels: 0,
      evolvedTo: null,
    }
  }

  let level = startLevel
  let exp = startExp + add
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level)
    level += 1
  }

  const stage = cappedStage(level, stageCount)
  const before = cappedStage(startLevel, stageCount)

  return {
    level,
    exp,
    evolutionStage: stage,
    gainedLevels: level - startLevel,
    evolvedTo: stage > before ? stage : null,
  }
}

/** 경험치 바 채움 비율 0~1. 화면에서 width %로 쓴다. */
export function expProgress(level: number, exp: number): number {
  const need = expToNextLevel(Math.max(1, level))
  if (need <= 0) return 0
  return Math.min(1, Math.max(0, exp / need))
}

// ── 마스코트 이모지 ───────────────────────────────────────────────────────────
//
// 이미지가 안 뜰 때 원판·배지 자리에 쓰는 폴백이다 (design.md).
// 2026-08-22: 6종 × 4단 = 24장을 public/art/pets 아래에 구웠다(scripts/slice-art.ts).
// URL은 lib/assets.ts가 만들고 환경변수를 읽지 않는다 — 이제 이모지로 떨어지는 조건은
// 스킨이 아직 없을 때(진단 전)와 <img>가 404를 낼 때 둘뿐이다.
// 기본 3종은 lib/types.ts의 TRIBE가 정본이라 여기 다시 적지 않는다.
// 화면 두 곳(PetView·SkinList)이 같이 쓰므로 컴포넌트가 아니라 여기에 둔다.

export const ANIMAL_EMOJI: Record<string, string> = Object.fromEntries(
  Object.values(TRIBE).map((tribe) => [tribe.animal, tribe.emoji]),
)

/**
 * 변종 스킨은 어미가 종족의 동물명이다(북극여우·북극고양이·북극곰). 이모지가 3종뿐이므로
 * 어미로 찾아 기본 동물 이모지를 그대로 쓴다 — 변종마다 이모지를 새로 적으면 스킨이
 * 늘 때마다 여기도 고쳐야 하고, 안 고치면 조용히 발자국이 뜬다.
 * 어미도 모르는 이름이 오면 화면이 비지 않게 발자국을 쓴다.
 */
export function animalEmoji(animal: string): string {
  const base = Object.keys(ANIMAL_EMOJI).find((name) => animal.endsWith(name))
  return base ? ANIMAL_EMOJI[base] : "🐾"
}

// ── 치장 목록 정렬 (SPEC.md 5절) ──────────────────────────────────────────────
//
// 화면(app/pet/cosmetics/page.tsx)과 API(app/api/pet/cosmetics)가 같은 목록을 만든다.
// 정렬을 각자 두면 조용히 어긋나므로 여기 한 곳에 둔다. DB를 모르는 순수 비교 함수다.

export const COSMETIC_SLOT_ORDER: readonly Slot[] = ["HAT", "SCARF", "BACKGROUND"]
export const COSMETIC_RARITY_ORDER: readonly Rarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"]

/** 슬롯 → 등급 → 이름 순. 화면이 매번 같은 순서로 보이게 고정한다 */
export function compareCosmetics(
  a: { slot: Slot; rarity: Rarity; name: string },
  b: { slot: Slot; rarity: Rarity; name: string },
): number {
  return (
    COSMETIC_SLOT_ORDER.indexOf(a.slot) - COSMETIC_SLOT_ORDER.indexOf(b.slot) ||
    COSMETIC_RARITY_ORDER.indexOf(a.rarity) - COSMETIC_RARITY_ORDER.indexOf(b.rarity) ||
    a.name.localeCompare(b.name, "ko")
  )
}

/**
 * 치장을 읽는 모든 곳이 쓰는 where 조각. **낡은 행을 코드에서 배제한다.**
 *
 * 공유 개발 DB에 `backgrounds/forest-autumn-*.png`를 가리키는 CosmeticItem 5행이 남아 있다.
 * `prisma/seed/items.ts`의 COSMETICS는 6종뿐이고 그 그림은 `public/art/`에 굽지도 않았다
 * (scripts/slice-art.ts). 결과로 치장 목록에 뜨지 않는 칸 5개가 생기고,
 * 수집 진행률 분모가 6이 아니라 11이 됐다.
 *
 * 지우는 코드는 이미 있다(prisma/seed/items.ts pruneCosmetics). 하지만 그건 시드 실행이고
 * 공유 DB에 쓰기를 낸다 — 지금은 손대지 않기로 한 곳이다. 낡은 미션 행(order = 4)을
 * 코드에서 배제한 것과 같은 방식으로 읽는 쪽에서 뺀다.
 *
 * 기준은 "구워 둔 그림이 있는 것"이다. 새 치장을 넣을 땐 imageKey를 `cosmetics/`로 시작하게
 * 두면 된다 — 아니면 여기 걸려 목록에서 조용히 사라진다.
 */
export const SHIPPED_COSMETIC = { imageKey: { startsWith: "cosmetics/" } } as const

// ── 방치형 자동 획득 (SPEC.md 5절) ────────────────────────────────────────────
//
// SPEC.md 5절은 "lastIdleClaimAt과 현재 시각의 차이로 씨앗을 누적하고 상한 12시간분"까지만
// 정한다. 시간당 개수는 명세에 없어서 C가 정했다 — 근거는 아래.
//
//   일일 미션 5개 = 60씨앗/일 (prisma/seed/missions.ts: 10+10+10+15+15)
//   방치형 2/시간 → 12시간 상한 = 한 번에 24씨앗, 하루 최대 48씨앗
//
// 방치형이 미션보다 많으면 "미션을 하러 오는" 앱이 아니라 "켜 두는" 앱이 된다.
// 그래서 미션 경로보다 낮게 뒀다. 팀에서 다시 정하면 이 상수 하나만 고친다
// (scripts/check-pet.ts가 값을 못 박아 두므로 조용히 바뀌면 거기서 걸린다).
export const IDLE_SEEDS_PER_HOUR = 2
/** 무한 누적 방지 상한. SPEC.md 5절이 정한 값이다 */
export const IDLE_CAP_HOURS = 12

const MS_PER_HOUR = 60 * 60 * 1000
/** 씨앗 1개가 쌓이는 데 걸리는 시간. 2/시간이면 30분 */
export const MS_PER_IDLE_SEED = MS_PER_HOUR / IDLE_SEEDS_PER_HOUR
/** 한 번에 받을 수 있는 최대 개수 (배율 적용 전) */
export const IDLE_MAX_SEEDS = IDLE_CAP_HOURS * IDLE_SEEDS_PER_HOUR

export type IdleAccrual = {
  /** 캐릭터 배율 적용 **전** 기본 개수. 호출부가 calculateReward()에 넣는다 */
  seeds: number
  /** 수령 후 저장할 lastIdleClaimAt */
  nextClaimAt: Date
  /** 다음 1개가 쌓이기까지 남은 밀리초. capped면 0 — 받아 가야 다시 쌓인다 */
  msToNextSeed: number
  /** 상한에 닿아 누적이 멈춰 있었는지. 화면 문구에 쓴다 */
  capped: boolean
}

/**
 * 접속 시점까지 쌓인 방치형 씨앗을 계산한다. 지급하지는 않는다 (순수 함수).
 * now를 인자로 받는 이유는 check:pet에서 시각을 고정해 검증하기 위해서다.
 */
export function idleAccrual(lastClaimAt: Date | null, now: Date): IdleAccrual {
  // 첫 접속은 기준 시각이 없다. 소급 지급하지 않고 지금을 기준으로 심는다.
  // 가입 즉시 12시간분을 주면 방치형이 아니라 가입 보너스가 된다 (명세에 없는 지급).
  if (!lastClaimAt) {
    return { seeds: 0, nextClaimAt: now, msToNextSeed: MS_PER_IDLE_SEED, capped: false }
  }

  const elapsed = now.getTime() - lastClaimAt.getTime()

  // 기준 시각이 미래면(시계 오차·수동 수정) 지급하지 않고 기준을 그대로 둔다
  if (elapsed <= 0) {
    return { seeds: 0, nextClaimAt: lastClaimAt, msToNextSeed: MS_PER_IDLE_SEED, capped: false }
  }

  const capMs = IDLE_CAP_HOURS * MS_PER_HOUR
  const capped = elapsed >= capMs
  const usable = capped ? capMs : elapsed
  const seeds = Math.floor(usable / MS_PER_IDLE_SEED)
  const creditedMs = seeds * MS_PER_IDLE_SEED

  // 상한을 넘긴 초과분은 버린다 (무한 누적 방지).
  // 넘기지 않았으면 1개에 못 미치는 자투리 시간을 다음 수령으로 넘긴다 —
  // 기준을 now로 밀어 버리면 자주 들여다보는 유저가 영구히 손해를 본다.
  const nextClaimAt = capped ? now : new Date(lastClaimAt.getTime() + creditedMs)

  return {
    seeds,
    nextClaimAt,
    msToNextSeed: capped ? 0 : MS_PER_IDLE_SEED - (usable - creditedMs),
    capped,
  }
}

// ── 배고픔 (2026-08-21 추가. SPEC.md 5절) ─────────────────────────────────────
//
// 마지막으로 씨앗을 먹인 시각(User.lastFedAt)에서 경과한 시간만으로 정해진다.
// 100 = 배부름, 0 = 비었음. 컬럼 하나(lastFedAt)로 끝나게 이렇게 잡았다 —
// hunger 값을 따로 저장하면 화면을 열 때마다 감쇠분을 써야 해서 읽기가 쓰기가 된다
// (방치형 씨앗을 페이지 로드 때 지급하지 않는 것과 같은 이유다).
//
// 투입한 씨앗 개수는 배고픔에 영향을 주지 않는다. 1개를 먹여도 100이 된다.
// "얼마나 먹였나"는 이미 경험치가 표현하고, 배고픔은 "얼마나 들여다봤나"만 본다.
//
// 배고픔이 0이 되어도 잃는 것은 없다. 재화·경험치·단계에 손대지 않는 표시 전용 값이다.
// 대상 이용자에게 벌점형 압박을 주지 않는다는 SPEC.md 5절 취지(랭킹·경쟁 지표 배제)와
// 같은 이유다. 여기에 페널티를 붙이려면 명세를 먼저 고친다.
export const HUNGER_MAX = 100
/** 배부름 100에서 0까지 걸리는 시간. 하루 한 번 들여다보면 유지되는 값이다 */
export const HUNGER_EMPTY_HOURS = 24
/** 이 값 아래면 화면이 경고색으로 바뀐다 */
export const HUNGER_LOW = 30

/**
 * 배고픔 0~100. since는 User.lastFedAt이고, 한 번도 먹인 적이 없으면
 * 호출부가 User.createdAt을 넘긴다 — 기준 시각이 아예 없으면 감쇠를 계산할 수 없고,
 * 그렇다고 신규 유저에게 0을 보여 주면 시작부터 굶긴 것처럼 보인다.
 */
export function hungerFor(since: Date | null, now: Date): number {
  if (!since) return HUNGER_MAX

  const elapsed = now.getTime() - since.getTime()
  // 기준 시각이 미래면(시계 오차·수동 수정) 감쇠하지 않는다
  if (elapsed <= 0) return HUNGER_MAX

  const spanMs = HUNGER_EMPTY_HOURS * MS_PER_HOUR
  const left = HUNGER_MAX * (1 - elapsed / spanMs)
  return Math.max(0, Math.min(HUNGER_MAX, Math.floor(left)))
}

/** 배고픔 게이지 옆에 쓸 한 줄. 문구는 화면 두 곳(펫 화면·진화 연출)이 함께 쓴다 */
export function hungerLabel(hunger: number): string {
  if (hunger >= 60) return "배부르고 기분이 좋아요"
  if (hunger >= HUNGER_LOW) return "조금 배고파졌어요"
  return "배가 고파요. 씨앗을 먹여 주세요"
}

// ── 다음 목표를 개수로 말한다 (2026-08-23 추가) ────────────────────────────────
//
// 화면이 지금까지 `Lv.25 마지막 진화`만 보여 줬다. 실제로 서비스되는 육성 게임
// (다마고치·포켓캠프·My Talking Tom)은 전부 다음 목표를 **남은 개수**로 알려 준다 —
// "Lv.25"는 지금 내가 무엇을 얼마나 해야 하는지 알려 주지 않는다.
//
// 경험치 곡선(lib/types.ts)이 expToNextLevel(L) = L × 100이므로 레벨 N까지의 누적은
// 100 × (1+2+…+(N-1)) = 50 × N × (N-1)이다. 씨앗은 그 값을 SEED_TO_EXP로 나눈 것.
// 곡선을 고치면 이 식도 같이 틀리므로 check:pet이 applySeeds를 실제로 돌려 교차 검증한다.

function expAtLevel(level: number): number {
  const n = Math.max(1, Math.floor(level))
  return 50 * n * (n - 1)
}

/**
 * 다음 진화까지 남은 씨앗 개수. 마지막 단계(4)에 이미 닿았으면 null.
 * stage는 도달할 단계 번호라 화면이 "성체까지"처럼 이름을 붙일 수 있다.
 */
export function seedsToNextStage(level: number, exp: number): { stage: number; seeds: number } | null {
  const gates = [EVOLUTION_LEVEL.STAGE2, EVOLUTION_LEVEL.STAGE3, EVOLUTION_LEVEL.STAGE4]
  const target = gates.find((gate) => Math.floor(level) < gate)
  if (target === undefined) return null

  const need = expAtLevel(target) - (expAtLevel(level) + Math.max(0, Math.floor(exp)))
  // 경계에서 0이 나오면 "0개만 더"가 되어 이상하다. 최소 1로 올린다
  return { stage: evolutionStageFor(target), seeds: Math.max(1, Math.ceil(need / SEED_TO_EXP)) }
}

// ── 펫의 한 줄 (2026-08-23 추가) ──────────────────────────────────────────────
//
// 벤치마크한 5종(Finch, 다마고치, ねこあつめ, My Talking Tom, 포켓캠프) 중 4종은
// 펫이 사용자에게 **먼저 말을 건다.** 우리 화면은 이름과 고정 단계 설명만 있어서
// 상태를 알려면 게이지를 읽어야 했다. 같은 숫자를 두 번 보여 주는 대신 펫이 말한다.
//
// 문구를 지시문("씨앗을 먹여 주세요")이 아니라 1인칭 상태("배가 조금 고파요")로 쓴다.
// 고립은둔 청년에게 앱이 할 일을 지시하면 그 자체가 압박이 된다 — SPEC.md 5절이
// 랭킹·경쟁 지표를 뺀 것과 같은 이유다. hungerLabel의 지시형 문구는 게이지 옆에
// 그대로 남겨 둔다(그쪽은 접근성 라벨이라 상태를 명확히 말해야 한다).
//
// 순수 함수다. DB도 시각도 읽지 않고 저장하는 값도 없다 — check:pet이 검증한다.

export type PetMoodTone = "hungry" | "harvest" | "soon" | "calm"
export type PetMood = {
  tone: PetMoodTone
  /** 말풍선에 그대로 넣는 한 줄 */
  text: string
}

// level로 골라 리렌더마다 바뀌지 않는다. Math.random()을 쓰면 1초 타이머가 돌 때마다
// 대사가 바뀌어 읽을 수 없다(PetView의 idle 카운터가 매초 리렌더를 낸다).
const CALM_LINES = [
  "여기 같이 있어 줘서 좋아요",
  "오늘도 와 줬네요",
  "창밖이 조용해요. 우리도 조용히 있어요",
  "천천히 해도 괜찮아요",
  "아무것도 안 해도 돼요. 그냥 있어 줄래요",
]

/**
 * 우선순위는 "지금 행동할 수 있는 것"이 위다.
 * 배고픔 → 씨앗 상한(더 안 쌓이니 손해가 진행 중) → 진화 임박 → 떨어진 씨앗 → 평온.
 */
export function petMood(state: {
  hunger: number
  level: number
  exp: number
  idleSeeds: number
  idleCapped: boolean
}): PetMood {
  if (state.hunger < HUNGER_LOW) return { tone: "hungry", text: "배가 조금 고파요…" }

  if (state.idleCapped || state.idleSeeds >= IDLE_MAX_SEEDS) {
    return { tone: "harvest", text: "씨앗이 가득 쌓였어요. 더는 안 늘어나요" }
  }

  const next = seedsToNextStage(state.level, state.exp)
  if (next && next.seeds <= 10) {
    return { tone: "soon", text: `씨앗 ${next.seeds}개만 더 먹으면 뭔가 달라질 것 같아요` }
  }

  if (state.idleSeeds > 0) {
    return { tone: "harvest", text: `방에 씨앗 ${state.idleSeeds}개가 떨어져 있어요` }
  }

  return { tone: "calm", text: CALM_LINES[Math.max(1, Math.floor(state.level)) % CALM_LINES.length] }
}

/**
 * 쓰다듬었을 때의 반응. 누른 횟수를 넘기면 같은 말이 연속으로 나오지 않는다.
 * 재화도 저장값도 움직이지 않는다 — 누르는 것 자체가 보상인 상호작용이다
 * (My Talking Tom·다마고치가 같은 구조다).
 */
export const PET_TOUCH_REPLIES = [
  "헤헤, 간지러워요",
  "좋아요. 조금 더요",
  "손이 따뜻하네요",
  "여기 있어 줘서 고마워요",
  "오늘 하루는 어땠어요?",
]

export function petTouchReply(count: number): string {
  return PET_TOUCH_REPLIES[Math.abs(Math.floor(count)) % PET_TOUCH_REPLIES.length]
}

// ── 시간대 인사 (2026-08-23 추가) ─────────────────────────────────────────────
//
// 벤치마크한 육성 게임 5종 중 4종이 접속 시각에 따라 다른 인사를 한다. 하루에 한 번
// 열어도 같은 문장만 나오면 "저장된 그림"으로 읽히고, 바뀌면 살아 있는 것으로 읽힌다.
//
// **시각을 읽는 것은 이 함수가 아니라 호출부다.** 서버(Lambda·UTC)와 브라우저(KST)의
// getHours()가 9시간 다르므로, 서버에서 렌더한 인사와 클라이언트 첫 렌더의 인사가
// 어긋나 hydration 경고가 난다. 호출부는 마운트 후에만 시각을 읽는다.
// 인자를 받는 순수 함수라 check:pet이 경계값을 검증할 수 있다.

export type TimeOfDay = "dawn" | "morning" | "afternoon" | "evening" | "night"

/** 0~23시를 5구간으로 나눈다. 범위를 벗어난 값은 0~23으로 감아 넣는다 */
export function timeOfDay(hour: number): TimeOfDay {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h < 6) return "dawn"
  if (h < 11) return "morning"
  if (h < 17) return "afternoon"
  if (h < 22) return "evening"
  return "night"
}

// 지시문이 아니라 1인칭 상태로 쓴다(CALM_LINES와 같은 이유).
// 새벽·밤은 특히 조심한다 — 이 시간에 앱을 여는 사람에게 "일찍 자라"는 말은 훈계다.
const TIME_GREETING: Record<TimeOfDay, string> = {
  dawn: "이 시간에 깨어 있었네요. 저도 같이 있을게요",
  morning: "좋은 아침이에요. 창문 한 번 열어 볼래요?",
  afternoon: "오늘 하루 어떻게 가고 있어요?",
  evening: "저녁이네요. 오늘 여기까지 온 것으로 충분해요",
  night: "하루가 끝났어요. 조용히 있어도 괜찮아요",
}

export function timeGreeting(hour: number): string {
  return TIME_GREETING[timeOfDay(hour)]
}

// ── 호흡 안내 (2026-08-23 추가. /pet/rest) ────────────────────────────────────
//
// 4-4-6 주기. 4-7-8(Weil)은 7초 참기가 처음 하는 사람에게 길어 중간에 포기하고,
// Calm·Headspace의 기본 안내도 들이쉬기보다 내쉬기를 길게 잡는다(부교감 우세).
// 합이 14초라 3분(180초)이 12.86주기 — 딱 맞지 않아도 된다. 카운트다운을 보여 주는
// 화면이 아니라 "아무것도 안 하는" 화면이라 주기가 끊기는 자리가 없다.
//
// 순수 함수다. 경계(0, 4, 8, 14)를 check:pet이 못 박는다.
export const BREATH_CYCLE = [
  { phase: "in", seconds: 4, label: "천천히 들이쉬어요" },
  { phase: "hold", seconds: 4, label: "잠깐 멈춰요" },
  { phase: "out", seconds: 6, label: "길게 내쉬어요" },
] as const

export type BreathPhase = (typeof BREATH_CYCLE)[number]["phase"]

/** 한 주기 길이(초). 14 */
export const BREATH_CYCLE_SECONDS = BREATH_CYCLE.reduce((sum, s) => sum + s.seconds, 0)

/**
 * 시작 후 경과 초 → 지금 어느 단계이고 그 단계가 몇 초 남았는지.
 * 원(circle) 크기와 안내 문구가 같은 값에서 나와야 어긋나지 않는다.
 */
export function breathAt(elapsedSeconds: number): {
  phase: BreathPhase
  label: string
  /** 이 단계 안에서의 진행도 0~1. 원의 지름에 쓴다 */
  progress: number
  /** 이 단계가 끝나기까지 남은 초(올림). 1 이상이다 */
  remaining: number
} {
  const t = Math.max(0, elapsedSeconds) % BREATH_CYCLE_SECONDS
  let start = 0
  for (const step of BREATH_CYCLE) {
    if (t < start + step.seconds) {
      const into = t - start
      return {
        phase: step.phase,
        label: step.label,
        progress: into / step.seconds,
        remaining: Math.max(1, Math.ceil(step.seconds - into)),
      }
    }
    start += step.seconds
  }
  // BREATH_CYCLE_SECONDS로 나눈 나머지는 항상 마지막 구간 안에 들어오므로 닿지 않는다
  const last = BREATH_CYCLE[BREATH_CYCLE.length - 1]
  return { phase: last.phase, label: last.label, progress: 1, remaining: 1 }
}
