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

// ── 배경 6종 — 코드·표시명·이미지 (2026-08-22 사용자 지정) ────────────────────
//
// DB(CosmeticItem.name)에는 **코드**를 저장하고("autumn_path") 화면에는 표시명을
// 보여 준다("노을빛 단풍길").
//
// 스키마에 code 컬럼을 새로 만들지 않았다. prisma/schema.prisma는 5인 합의 파일이고
// 컬럼 추가는 공유 DB 마이그레이션이다(CLAUDE.md 1·5절) — 마감 하루 전에 혼자 낼 변경이
// 아니다. name이 이미 유니크 upsert 키라 코드가 들어갈 자리로 맞고, 표시명이 바뀌어도
// 키가 흔들리지 않는다는 이점이 오히려 있다(옛 "배경1"~"배경6"은 이름을 고칠 때마다
// 시드가 새 행을 만들 위험이 있었다. prisma/seed/items.ts의 pruneCosmetics 주석 참고).
//
// 이 배열의 순서가 곧 상점 진열 순서다(아래 compareCosmetics가 인덱스로 정렬한다).
// 사용자가 준 순서를 그대로 둔다 — 코드 가나다순으로 정렬하면 aurora_field가 맨 앞으로
// 와서 계절 흐름(가을 → 숲 → 봄 → 오로라 → 빙해 → 겨울)이 깨진다.
//
// imageKey는 S3 실제 파일명이다. 파일명(forest-autumn-*)과 장면이 어긋나 보이는 것은
// 생성 배치 이름이 그대로 붙었기 때문이고, 어느 키가 어느 장면인지는 그림을 열어 확인했다.
// prisma/seed/items.ts와 화면이 이 한 배열을 함께 쓴다 — 두 곳에 적으면 조용히 갈라진다.
export const BACKGROUNDS = [
  { code: "autumn_path", label: "노을빛 단풍길", imageKey: "backgrounds/forest-autumn-0-0.png" },
  { code: "forest_camp", label: "숲 속 캠프", imageKey: "backgrounds/forest-autumn-0-1.png" },
  { code: "spring_garden", label: "봄날의 정원", imageKey: "backgrounds/forest-autumn-1-0.png" },
  { code: "aurora_field", label: "오로라 들판", imageKey: "backgrounds/forest-autumn-1-1.png" },
  { code: "frozen_ocean", label: "푸른 빙해", imageKey: "backgrounds/forest-autumn-2-0.png" },
  { code: "winter_village", label: "눈꽃 마을", imageKey: "backgrounds/forest-autumn-2-1.png" },
] as const

const LABEL_BY_CODE = new Map(BACKGROUNDS.map((bg) => [bg.code as string, bg.label as string]))
const ORDER_BY_CODE = new Map(BACKGROUNDS.map((bg, i) => [bg.code as string, i]))

/**
 * 코드 → 화면에 띄울 이름. 모르는 코드는 그대로 돌려준다 —
 * 옛 이름("배경1")이 남은 DB나 나중에 추가된 아이템이 빈 칸으로 보이지 않게 한다.
 */
export function cosmeticLabel(code: string): string {
  return LABEL_BY_CODE.get(code) ?? code
}

/** 진열 순서. 목록에 없는 코드는 뒤로 보낸다 */
function cosmeticOrder(code: string): number {
  return ORDER_BY_CODE.get(code) ?? Number.MAX_SAFE_INTEGER
}

// ── 치장 목록 정렬 (SPEC.md 5절) ──────────────────────────────────────────────
//
// 화면(app/pet/cosmetics/page.tsx)과 API(app/api/pet/cosmetics)가 같은 목록을 만든다.
// 정렬을 각자 두면 조용히 어긋나므로 여기 한 곳에 둔다. DB를 모르는 순수 비교 함수다.

export const COSMETIC_SLOT_ORDER: readonly Slot[] = ["HAT", "SCARF", "BACKGROUND"]
export const COSMETIC_RARITY_ORDER: readonly Rarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"]

/**
 * 슬롯 → 등급 → 진열 순서 → 이름 순. 화면이 매번 같은 순서로 보이게 고정한다.
 *
 * 2026-08-22: 이름이 코드가 되면서 진열 순서 단계가 들어왔다. 코드 가나다순으로는
 * 사용자가 정한 순서(가을 → … → 겨울)가 나오지 않는다. BACKGROUNDS에 없는 이름끼리는
 * 인덱스가 같아 그대로 가나다순으로 떨어진다.
 */
export function compareCosmetics(
  a: { slot: Slot; rarity: Rarity; name: string },
  b: { slot: Slot; rarity: Rarity; name: string },
): number {
  return (
    COSMETIC_SLOT_ORDER.indexOf(a.slot) - COSMETIC_SLOT_ORDER.indexOf(b.slot) ||
    COSMETIC_RARITY_ORDER.indexOf(a.rarity) - COSMETIC_RARITY_ORDER.indexOf(b.rarity) ||
    cosmeticOrder(a.name) - cosmeticOrder(b.name) ||
    a.name.localeCompare(b.name, "ko")
  )
}

// SHIPPED_COSMETIC이 있던 자리다(2026-08-24 삭제). `imageKey`가 `cosmetics/`로 시작하는
// 행만 고르는 where 조각이었는데, C가 배경 6종을 `backgrounds/…` 키로 다시 심어서
// 공유 DB 6행 중 **0행**이 걸렸다 — 배경 상점이 빈 화면이었다. 지금 DB의 6행이 곧 판매
// 목록 전체라 필터가 필요 없다. 다시 넣지 말 것: 판매 목록은 시드가 정하고, 코드가
// imageKey 접두사로 다시 걸러 봤자 시드와 규칙이 갈라지는 지점만 하나 늘어난다.

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

// ── 배고픔 — 삭제 (2026-08-21 사용자 결정) ────────────────────────────────────
//
// 하루 만에 넣고 뺐다. 있던 것: `lastFedAt`에서 경과 시간만으로 100 → 0을 24시간에
// 선형 감쇠시켜 게이지로 보여 주는 표시 전용 값(`hungerFor`·`hungerLabel`·`HUNGER_*`).
// 게이지가 있던 자리는 재화 3종(씨앗·별조각·친밀도) + 상점 입구 2개가 대신 쓴다.
//
// `User.lastFedAt` 컬럼은 남겨 뒀다. 이유 두 가지다.
// - "일단 삭제"라서 되살릴 수 있어야 한다. 계산식이 시각 하나만 보므로 컬럼이 남아 있으면
//   이 함수를 다시 붙이는 것으로 끝난다. 컬럼을 지웠다 되살리면 그 사이 기록이 비어
//   전원이 만복으로 리셋된다
// - `prisma/schema.prisma`는 5인 공유 파일이고 컬럼 드롭은 공유 DB 마이그레이션이다
//   (CLAUDE.md 1·5절). 개발 마감 하루 전에 혼자 낼 변경이 아니다
//
// 그래서 `POST /api/pet/feed`는 `lastFedAt`을 계속 쓴다. 읽는 곳은 아직 없다.
// (2026-08-23에 아래 환영 문구가 잠깐 이 값을 읽었다가, 같은 날 사용자가 "날짜와 상관없이"로
//  정해 다시 안 읽게 됐다. 컬럼을 남겨 둔 이유는 그대로 위 두 가지다)

// ── 펫 대사 (2026-08-23) ──────────────────────────────────────────────────────
//
// 방에 들어오면 펫이 말풍선으로 한 줄을 건네고, 머무는 동안 평상시 대사로 바뀐다.
// 목적은 **죄책감을 주지 않는 복귀**다 — 이 앱의 타겟은 실패 경험이 누적된 사람이고
// (우울 57% · 소진 85%), 안 온 것을 지적하는 화면을 만나면 "또 실패했다"의 증거가 하나 더
// 생겨 그 자리에서 앱을 지운다. 배고픔 게이지를 걷어낸 것과 같은 판단이며, 이 대사들이
// 그 자리를 반대 방향으로 메운다.
//
// **문장은 전부 사용자가 직접 쓴 것이다 (2026-08-23).** 한 글자도 바꾸지 않았다.
// 고칠 일이 있으면 임의로 다듬지 말고 사용자에게 확인한다.
//
// 이 기능은 하루에 세 번 모양이 바뀌었다. 기록으로 남긴다 —
//  1차: 비운 일수로 3구간(2~3일 / 4~6일 / 7일 이상, 이틀 미만은 안 띄움)
//  2차: 사용자가 "날짜랑 상관 없게" → 일수 계산·구간 분기를 전부 걷고 고정 한 줄
//  3차: 사용자가 접속 10문장 + 평상시 10문장을 직접 써서 넘김 → 지금 이 형태
// 2차에서 마지막 접속 시각(`max(lastFedAt, lastIdleClaimAt)`)을 안 보게 됐고 그건 그대로다.
// 시계 오차·미래 시각·"새 유저는 기준이 없다" 같은 경계 처리가 이 기능에는 없다.
//
// 남은 규칙은 하나다. **비운 일수를 문장에 넣지 않는다** — "3일 만이네요"는 사실이지만
// 질책으로 읽힌다. 사용자가 준 20문장 전부 이 규칙을 지킨다(일수를 아예 세지 않는다).
// `scripts/check-pet.ts`가 일수 표현을 못 박는다 — 나중에 문장을 보태는 사람이 규칙을
// 모르고 "며칠 만이야?"를 넣으면 거기서 걸린다.
//
// 내가 앞서 세웠던 톤 규칙 두 개는 사용자 결정으로 사라졌다.
//  - "느낌표를 쓰지 않는다" → 사용자 문장이 느낌표를 쓴다. 밝은 반말이 이 펫의 목소리다
//  - "펫이 기다렸다·보고 싶었다는 암시를 넣지 않는다" → 사용자가 그 표현을 직접 골랐다
//    ("기다리고 있었어", "보고 싶었는데 딱 왔네"). 돌봄을 부채로 만든다고 봤던 판단을
//    사용자가 뒤집었다
// 다만 펫이 **나빠졌다**는 표현(외로웠어·아팠어·힘들었어)은 20문장에 없고, 넣지 않는다.
// 기다림은 애정이고 악화는 처벌이다 — 경계는 거기다.

/**
 * 접속했을 때. 페이지에 들어오면 이 중 하나가 말풍선에 뜬다.
 * 사용자가 쓴 문장이다 — 순서·표기·느낌표를 그대로 둔다.
 */
export const PET_GREETINGS = [
  "왔네! 기다리고 있었어.",
  "오늘도 와줬네! 반가워~",
  "왔어? 나 방금 네 생각하고 있었어!",
  "어, 왔다! 오늘은 무슨 하루였어?",
  "오늘도 안녕! 잘 왔어!",
  "보고 싶었는데 딱 왔네!",
  "왔구나! 나랑 조금 놀다 갈래?",
  "오늘은 어떤 기분이야? 나는 네가 와서 좋아.",
  "네가 오니까 갑자기 여기가 덜 조용해졌어.",
  "기다리다 보니까 네가 왔네. 오늘도 만나서 반가워!",
] as const

/**
 * 평상시. 인사 뒤에 머무는 동안 하나씩 바뀐다.
 *
 * 질문형이 많은데 답을 받는 입력칸은 두지 않았다(명세에 없다. 대화는 7절 챗봇이 한다).
 * 답하지 않아도 되는 질문이 이 화면의 성격에 맞다 — 혼잣말을 옆에서 듣는 쪽이다.
 */
export const PET_IDLE_LINES = [
  "오늘 하늘 봤어? 나는 못 봤지만 궁금해!",
  "그냥 있는 게 제일 좋을 때도 있는 거잖아.",
  "나 방금 네 생각하고 있었어!",
  "오늘은 뭐 먹었어? 나는 네가 뭘 먹었는지 궁금해.",
  "창밖에 뭐가 보일까? 나는 여기서 상상하고 있어.",
  "오늘 하루도 천천히 흘러가고 있네.",
  "아무 일 없는 날도 나쁘지 않은 것 같아.",
  "혹시 지금 조금 쉬고 있어? 나도 같이 쉴래.",
  "네가 없어도 나는 여기 있을게.",
  "오늘 하루 중에 제일 기억에 남는 순간은 뭐였을까?",
] as const

/**
 * 문자열에서 문구 인덱스를 뽑는다. 문자 코드 합의 나머지다 — 암호용이 아니라
 * "매번 같은 문장만 보이지 않게" 흩기 위한 것이므로 이 정도로 충분하다.
 *
 * `Math.random()`을 쓰지 않는 이유가 있다. 이 값을 서버 컴포넌트에서 정하는데(app/pet/page.tsx)
 * 렌더마다 달라지면 하이드레이션에서 서버 HTML과 클라이언트 첫 렌더가 어긋난다.
 * 같은 입력에 같은 값이 나와야 한다.
 */
export function lineIndex(seed: string, count: number): number {
  if (count <= 0) return 0
  let sum = 0
  for (let i = 0; i < seed.length; i += 1) sum += seed.charCodeAt(i)
  return sum % count
}

/**
 * 접속 인사 한 줄 (순수 함수).
 *
 * @param seed 유저·날짜처럼 렌더 사이에 안 바뀌는 문자열. 같은 사람이 같은 날 새로고침하면
 *             같은 인사가 나오고, 날이 바뀌면 다른 인사가 나온다
 */
export function greetingFor(seed: string): string {
  return PET_GREETINGS[lineIndex(seed, PET_GREETINGS.length)]
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

// "hungry"가 있던 자리다(2026-08-24 삭제). 배고픔 게이지를 걷으면서 HUNGER_LOW도 사라졌는데
// 이 분기만 남아 빌드가 깨져 있었다 — 병합에서 한쪽은 상수를 지우고 다른 쪽은 petMood를
// 지키면 이렇게 된다. 되살리려면 위 "배고픔 — 삭제" 주석의 계산식부터 되돌려야 한다
export type PetMoodTone = "harvest" | "soon" | "calm"
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
 * 씨앗 상한(더 안 쌓이니 손해가 진행 중) → 진화 임박 → 쌓인 씨앗 → 평온.
 *
 * `hour`는 급한 상태가 없을 때(tone `calm`)만 쓴다 — 그때만 시간대 인사로 바꾼다.
 * null/미지정이면 CALM_LINES를 레벨로 골라 쓴다. 이게 **서버 렌더와 첫 페인트의 값**이다:
 * 서버(UTC)와 브라우저(KST)의 `getHours()`가 9시간 달라 서버에서 시각을 읽으면
 * hydration이 어긋난다. 그래서 호출부가 마운트 후에 시각을 넣어 준다.
 *
 * 2026-08-23: 이 분기가 화면 쪽에 `mood.tone === "calm" ? timeGreeting(hour) : mood.text`로
 * 있었다. 그러면 CALM_LINES 5줄이 **첫 페인트에만** 스치고 사실상 죽은 문구가 된다 —
 * 어느 문장이 실제로 나오는지 화면 코드를 읽어야 알 수 있었다. 여기로 합쳐
 * check:pet이 "hour를 주면 시간대 인사, 안 주면 CALM_LINES"를 못 박는다.
 */
export function petMood(
  state: {
    level: number
    exp: number
    idleSeeds: number
    idleCapped: boolean
  },
  hour?: number | null,
): PetMood {
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

  if (hour !== undefined && hour !== null) return { tone: "calm", text: timeGreeting(hour) }
  return { tone: "calm", text: CALM_LINES[Math.max(1, Math.floor(state.level)) % CALM_LINES.length] }
}

/**
 * 레벨이 올랐을 때의 반응. 오르지 않았으면 null이고 호출부가 먹이기 기본 대사로 떨어진다.
 *
 * API(app/api/pet/feed)가 gainedLevels를 돌려주는데도 화면이 그걸 **버리고** 있었다.
 * 진화(4번)에만 연출이 있어서 그 사이 스물네 번의 레벨업은 게이지가 0으로 돌아가는
 * 것으로만 보였다 — 벤치마크한 육성 게임 5종은 전부 레벨업을 따로 알린다.
 *
 * 숫자 뒤에 조사를 붙이지 않는다. "Lv.5이/가"는 숫자를 읽는 법(오/다섯)에 따라 받침이
 * 갈려 어느 쪽을 써도 틀린 문장이 된다(withSubject는 한글 종성만 본다). 레벨 값으로 문장을 끝낸다.
 */
export function levelUpReply(gainedLevels: number, level: number): string | null {
  if (gainedLevels < 1) return null
  if (gainedLevels === 1) return `레벨이 올랐어요! 이제 Lv.${level}`
  return `레벨이 ${gainedLevels} 올랐어요! 이제 Lv.${level}`
}

/**
 * 쓰다듬었을 때의 반응. 누른 횟수를 넘기면 같은 말이 연속으로 나오지 않는다.
 * 재화도 저장값도 움직이지 않는다 — 누르는 것 자체가 보상인 상호작용이다
 * (My Talking Tom·다마고치가 같은 구조다).
 *
 * 2026-08-24: **문구를 PET_IDLE_LINES로 갈았다(사용자 결정).** 전에는 여기 따로
 * 5문구("헤헤, 간지러워요" 등)를 두고 있었는데, 그 5개는 내가 쓴 것이고 C의 20문구와
 * 어투가 달랐다 — 존댓말 대 반말이고, 갈색 테두리 말풍선(data-tone="touch")으로
 * 눈에도 구분됐다. 한 펫이 만질 때만 다른 사람처럼 말하는 셈이었다.
 * 이제 펫이 하는 말은 전부 사용자가 쓴 20문구뿐이다.
 *
 * 접속 인사(PET_GREETINGS)가 아니라 평상시(PET_IDLE_LINES)를 쓴다 — 이미 방에 있는
 * 펫을 만졌는데 "왔네! 기다리고 있었어."가 나오면 맥락이 어긋난다.
 */
export function petTouchReply(count: number): string {
  return PET_IDLE_LINES[Math.abs(Math.floor(count)) % PET_IDLE_LINES.length]
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

// ── 함께한 기록 (2026-08-23 추가) ─────────────────────────────────────────────
//
// 벤치마크 5종 전부가 **누적된 것**을 보여 준다 — 다마고치는 나이(일수), Finch는 여정
// 기록, ねこあつめ는 온 고양이 수, 포켓캠프는 앨범이다. 우리 화면에는 "지금 상태"
// (레벨·게이지·단계)만 있고 **지나온 것**이 없었다. 하루 접속을 여러 주 이어 온 사용자와
// 오늘 처음 온 사용자의 화면이 레벨 말고는 같다.
//
// 이 서비스에서는 그게 특히 아쉬운 자리다. 랭킹·경쟁 지표를 배제한 것은(SPEC.md 5절)
// **남과 비교**하지 않겠다는 뜻이고, 자기 누적을 보여 주는 것은 그 반대가 아니다.
// 비교 대상이 과거의 자신이면 "얼마나 부족한지"가 아니라 "얼마나 왔는지"가 나온다.
//
// 캘린더 날짜 차이가 아니라 **경과 시간**으로 센다. 서버는 UTC고 브라우저는 KST라
// 달력으로 세면 자정 근처에서 두 값이 하루 어긋난다(timeGreeting과 같은 문제).
// 가입 당일이 1일째다 — 0일째라고 말하는 화면은 "아직 아무것도 아니다"로 읽힌다.

const MS_PER_DAY = 24 * MS_PER_HOUR

/** 가입일부터 오늘까지 며칠째인가. 가입 당일이 1이고 그 아래로 내려가지 않는다 */
export function daysTogether(createdAt: Date | null, now: Date): number {
  if (!createdAt) return 1
  const elapsed = now.getTime() - createdAt.getTime()
  if (elapsed <= 0) return 1
  return Math.floor(elapsed / MS_PER_DAY) + 1
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
