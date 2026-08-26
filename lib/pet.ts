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
// SPEC.md 5절은 "lastIdleClaimAt과 현재 시각의 차이로 씨앗을 누적하고 상한을 둔다"까지만
// 정한다. 시간당 개수는 명세에 없어서 C가 정했다 — 근거는 아래.
//
//   일일 미션 5개 = 60씨앗/일 (prisma/seed/missions.ts: 10+10+10+15+15)
//   방치형 2/시간 → 하루 최대 48씨앗 (시간이 흐르는 속도가 상한이다)
//
// 방치형이 미션보다 많으면 "미션을 하러 오는" 앱이 아니라 "켜 두는" 앱이 된다.
// 그래서 미션 경로보다 낮게 뒀다. 팀에서 다시 정하면 이 상수 하나만 고친다
// (scripts/check-pet.ts가 값을 못 박아 두므로 조용히 바뀌면 거기서 걸린다).
export const IDLE_SEEDS_PER_HOUR = 2
/**
 * 무한 누적 방지 상한.
 *
 * **2026-08-24 사용자 결정으로 12 → 50시간(= 씨앗 100개)이 됐다.** 같은 날 이 카드에
 * 게이지를 붙이면서 정한 값이다 — 게이지가 끝까지 차는 모습이 보여야 해서 상한이 곧
 * 게이지의 최대치가 된다(app/pet/_components/PetView.tsx의 방치형 카드).
 *
 * **시간당 개수는 안 바꿨다.** 그래서 하루에 방치형으로 들어오는 양의 최대치는 여전히
 * 48개(2 × 24시간)이고 미션 경로(60)를 넘지 않는다. 바뀐 것은 "며칠 못 들어온 사람이
 * 돌아왔을 때 얼마까지 남아 있는가"다 — 12시간분(24개)에서 잘리던 것이 약 2일분까지 남는다.
 * 하루에 한 번 들어오는 사람은 전에는 24개에서 잘렸지만 이제 24시간분 48개를 다 받는다.
 */
export const IDLE_CAP_HOURS = 50

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
  // 가입 즉시 상한만큼 주면 방치형이 아니라 가입 보너스가 된다 (명세에 없는 지급).
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

// ── 펫 외출 ───────────────────────────────────────────────────────────────────
//
// 기획: 친밀도 200 소모 → 펫 외출 → 4시간 뒤 복귀 시 에피소드 + 랜덤 재화.
// 계획 전문과 값의 근거는 docs/dev/pet.md "펫 외출 시스템"을 본다.
//
// 이 절은 **DB와 화면을 모르는 순수 함수만** 둔다. PetOuting 표가 아직 없어도(마이그레이션
// 미적용) 컴파일되고 check:pet으로 검증된다 — 그래서 스키마 합의를 기다리지 않고 값을
// 코드로 먼저 고정할 수 있다. 이 파일이 값의 유일한 출처이고 API·화면이 여기서 읽는다.

/**
 * 외출 1회 비용.
 *
 * **200인 이유는 lib/reward.ts의 AFFINITY_DAILY_CAP이 100이라서다** — 하루에 최대 100밖에
 * 벌 수 없으므로 200은 곧 "최소 2일에 1회"다. 매일 나갈 수 있으면 사건이 아니라 일과가 된다.
 *
 * 여기서 AFFINITY_DAILY_CAP을 import하지 않는 것은 의도다. lib/pet.ts는 재화 규칙을 모르는
 * 쪽으로 유지한다. 대신 check:pet이 두 파일을 함께 읽어 비율 2를 못 박으므로, 어느 한쪽을
 * 바꾸면 "2일 1회" 페이싱이 조용히 무너지는 대신 체크에서 걸린다.
 */
export const OUTING_COST_AFFINITY = 200

/**
 * 다녀오는 데 걸리는 시간.
 *
 * 방치형 씨앗이 MS_PER_IDLE_SEED = 30분/개라 그보다 확실히 길어야 두 장치가 구분된다.
 * 4시간이면 오전에 보내면 오후에 온다 — 하루에 한 번 들어오는 사용자도 같은 날 받는다.
 */
export const OUTING_HOURS = 4
export const OUTING_MS = OUTING_HOURS * 60 * 60 * 1000

/** 보상 범위. 씨앗과 별조각에 **각각** 굴린다 (둘 다 나온다) */
export const OUTING_REWARD_MIN = 30
export const OUTING_REWARD_MAX = 50

/**
 * 외출 보상을 뽑는다. 배율 적용 **전** 기본 수량이다 — 호출부가 calculateReward()에 넣는다.
 *
 * rand를 주입받는 이유: Math.random()을 안에 박으면 check:pet이 경계(30·50)를 검증할 수
 * 없다. idleAccrual()이 now를 받는 것과 같은 이유다.
 *
 * **씨앗과 별조각을 둘 다 준다.** 「둘 중 하나만 랜덤」이면 2일에 한 번뿐인 이벤트에서
 * 절반이 "씨앗만 나왔네"가 되고 사용자는 그걸 실패로 읽는다. 꽝을 만들지 않는다.
 */
export function rollOutingReward(rand: () => number): { seeds: number; starShards: number } {
  const roll = () => {
    const span = OUTING_REWARD_MAX - OUTING_REWARD_MIN + 1
    // rand()가 1을 반환하면(경계) MAX를 넘으므로 잘라 낸다
    return Math.min(OUTING_REWARD_MAX, OUTING_REWARD_MIN + Math.floor(rand() * span))
  }
  return { seeds: roll(), starShards: roll() }
}

/**
 * 갈 수 있는 장소. **stage는 펫 진화 단계(1~4)이고, 그 단계 이하가 후보가 된다** —
 * 펫이 자라면 갈 수 있는 범위가 밖으로 넓어진다. 사용자의 회복 범위와 같은 모양이다.
 *
 * 문장은 키로 저장한다(placeKey). 문장을 DB에 저장하면 나중에 문구를 다듬을 때 옛 기록이
 * 옛 문장으로 굳는다 — PET_IDLE_LINES를 상수로 둔 것과 같은 판단이다.
 */
/**
 * 여행일기의 결과 문장. **사건의 유형(tag)에 붙는다** — 사건마다 결과를 따로 쓰면 120줄이 되고,
 * 완전히 독립 축으로 두면 "그림을 그렸는데 / 파도가 지웠어"가 엉뚱한 사건에 붙는다.
 * 유형 6개 × 3개로 사건 60개를 전부 덮는다.
 *
 * **비율이 규칙이다.** 각 유형의 세 줄은 ① 해냈다 ② 좋았다 ③ 담담·미완 순이고,
 * 활동적인 쪽이 2 : 담담한 쪽이 1이다.
 *
 * 왜 이 비율인가 (2026-08-26 사용자 결정):
 * - 계속 시들하면 친밀도 200을 태운 값이 안 보인다 → 보람이 사라진다
 * - 완전히 씩씩하면 "얘는 나랑 다르네"가 된다 → 동질감이 사라진다
 * - **펫은 사용자보다 반 걸음 앞선다.** 겁도 내지만 결국 해본다
 *
 * ③을 없애지 않는 이유는 그것이 실패 여지이기 때문이다. 아무 일 없는 날이 결함처럼
 * 읽히면 안 된다 — 미션 문구의 "나가지 않아도 괜찮아요"와 같은 장치다.
 */
export const OUTING_RESULTS = {
  water: [
    "차가운데 계속 있어봤어.",
    "물살이 발가락 사이로 지나가는 게 좋았어.",
    "생각보다 차가워서 금방 뺐어.",
  ],
  walk: [
    "다리에 힘이 좀 붙은 것 같아.",
    "걷는 동안 바람이 계속 따라왔어.",
    "가다가 한 번 멈췄어.",
  ],
  stay: [
    "생각보다 오래 있었어.",
    "자리가 편해서 좀 더 있었어.",
    "시간이 얼마나 갔는지 몰랐어.",
  ],
  look: ["끝까지 지켜봤어.", "계속 보고 있으니까 재미있었어.", "오래 봤는데 잘 모르겠더라."],
  smell: ["계속 킁킁거렸어.", "좋은 냄새라서 한참 있었어.", "무슨 냄새인지는 몰랐어."],
  touch: ["한 번 더 해봤어.", "느낌이 좋아서 조금 더 있었어.", "조금 놀라서 발을 뗐어."],
} as const

export type OutingResultTag = keyof typeof OUTING_RESULTS

type OutingDeed = { key: string; text: string; tag: OutingResultTag }
type OutingSight = { key: string; text: string }
type OutingPlace = {
  key: string
  /** 펫 진화 단계. **2가 최소다** — 1단계(알)는 외출하지 않는다(2026-08-26 사용자 결정) */
  stage: number
  where: string
  text: string
  /** 펫이 한 일. 4개 중 1개를 뽑는다 */
  deeds: readonly OutingDeed[]
  /** 그냥 거기 있던 것. 3개 중 1개를 뽑는다. **펫에게 아무것도 요구하지 않는다** */
  sights: readonly OutingSight[]
}

/**
 * 갈 수 있는 장소 15곳. **stage 이하가 후보가 된다** — 펫이 자라면 범위가 밖으로 넓어지고,
 * 그 모양이 사용자의 100단계 사다리와 같다.
 *
 * **활동성은 톤이 올리고 범위는 stage가 잡는다.** 2단계 펫도 활발하게 돌아다니지만
 * 집 근처를 벗어나지 않는다. 이렇게 나누면 노출 위계가 안 깨진다.
 *
 * 문장은 키로 저장한다 — 문장을 DB에 넣으면 나중에 문구를 다듬을 때 옛 기록이 옛 문장으로
 * 굳는다(PET_IDLE_LINES를 상수로 둔 것과 같은 판단).
 *
 * 2026-08-26에 8곳 → 15곳으로 늘리고 축을 5개로 나눴다(장소·사건·결과·만난것·기분).
 * 전에는 "만난 것"이 장소와 독립이라 `부엌 / 빨래 걷는 할머니가 계셨어`가 나왔다.
 * 그리고 1단계 장소(창가·부엌)는 **애초에 외출이 아니어서** 버렸다.
 */
export const OUTING_PLACES: readonly OutingPlace[] = [
  // ── 2단계: 집 근처. 사람이 없다 ──
  {
    key: "doorstep",
    stage: 2,
    where: "문 앞",
    text: "문 앞 계단에 나가 있었어.",
    deeds: [
      { key: "down", text: "계단을 끝까지 내려갔어.", tag: "walk" },
      { key: "peek", text: "문 앞에 서서 골목 끝까지 봤어.", tag: "look" },
      { key: "twostep", text: "문 밖으로 나가서 좀 걸었어.", tag: "walk" },
      { key: "sun", text: "해 드는 자리를 찾아 옮겨 앉았어.", tag: "stay" },
    ],
    sights: [
      { key: "mail", text: "우편함에 뭐가 꽂혀 있었어." },
      { key: "door", text: "옆집 문이 한 번 열렸다 닫혔어." },
      { key: "laundry", text: "어디선가 빨래 냄새가 났어." },
    ],
  },
  {
    key: "alley",
    stage: 2,
    where: "골목",
    text: "골목으로 들어갔어.",
    deeds: [
      { key: "wall", text: "담벼락 따라 끝까지 걸었어.", tag: "walk" },
      { key: "lean", text: "벽에 기대서 좀 쉬었어.", tag: "stay" },
      { key: "shadow", text: "그림자만 밟고 걸어봤어.", tag: "walk" },
      { key: "crack", text: "담벼락 틈에 코를 대 봤어.", tag: "smell" },
    ],
    sights: [
      { key: "pots", text: "화분 몇 개가 줄지어 있었어." },
      { key: "bike", text: "자전거가 세워져 있었어." },
      { key: "flap", text: "위에서 빨래가 펄럭였어." },
    ],
  },
  {
    key: "stairs",
    stage: 2,
    where: "계단",
    text: "계단을 올라가 봤어.",
    deeds: [
      { key: "top", text: "한 칸씩 끝까지 올라갔어.", tag: "walk" },
      { key: "mid", text: "중간에 앉아서 아래를 봤어.", tag: "stay" },
      { key: "rail", text: "손잡이 밑으로 지나가 봤어.", tag: "touch" },
      { key: "downlook", text: "위에서 아래를 한참 내려다봤어.", tag: "look" },
    ],
    sights: [
      { key: "shoes", text: "누가 놓고 간 신발이 있었어." },
      { key: "light", text: "창으로 빛이 길게 들어왔어." },
      { key: "steps", text: "발소리가 위에서 났어." },
    ],
  },
  {
    key: "flowerbed",
    stage: 2,
    where: "화단",
    text: "화단 옆에 있었어.",
    deeds: [
      { key: "leaf", text: "잎사귀를 발로 건드려 봤어.", tag: "touch" },
      { key: "soil", text: "흙 냄새를 맡아봤어.", tag: "smell" },
      { key: "round", text: "화단을 한 바퀴 돌았어.", tag: "walk" },
      { key: "curl", text: "그 옆에 웅크리고 있었어.", tag: "stay" },
    ],
    sights: [
      { key: "flower", text: "이름 모를 꽃이 피어 있었어." },
      { key: "ants", text: "개미가 줄지어 지나갔어." },
      { key: "wet", text: "물 준 자리가 아직 젖어 있었어." },
    ],
  },
  {
    key: "parking",
    stage: 2,
    where: "주차장",
    text: "주차장을 지나갔어.",
    deeds: [
      { key: "run", text: "넓은 데를 한 번 뛰어봤어.", tag: "walk" },
      { key: "shade", text: "차 밑 그늘에 들어가 봤어.", tag: "stay" },
      { key: "tire", text: "바퀴에 코를 대 봤어.", tag: "smell" },
      { key: "car", text: "지나가는 차를 눈으로 따라갔어.", tag: "look" },
    ],
    sights: [
      { key: "quiet", text: "아무도 없이 조용했어." },
      { key: "engine", text: "어디선가 시동 소리가 났어." },
      { key: "line", text: "바닥에 흰 선이 길게 있었어." },
    ],
  },

  // ── 3단계: 동네. 사람이 있지만 스치기만 한다 ──
  {
    key: "park",
    stage: 3,
    where: "공원",
    text: "동네 공원에 들렀어.",
    deeds: [
      { key: "dash", text: "풀밭을 가로질러 달렸어.", tag: "walk" },
      { key: "lie", text: "풀밭에 누워서 하늘을 봤어.", tag: "stay" },
      { key: "bench", text: "벤치 위로 올라가 봤어.", tag: "touch" },
      { key: "fountain", text: "분수 물에 발을 담가 봤어.", tag: "water" },
    ],
    sights: [
      { key: "cat", text: "낮잠 자는 고양이가 두 걸음 옆에 있었어." },
      { key: "ball", text: "공놀이하는 소리가 저쪽에서 났어." },
      { key: "tree", text: "나보다 훨씬 큰 나무가 있었어." },
    ],
  },
  {
    key: "busstop",
    stage: 3,
    where: "정류장",
    text: "버스 정류장에 서 있었어.",
    deeds: [
      { key: "table", text: "시간표를 올려다봤어.", tag: "look" },
      { key: "under", text: "의자 밑에 들어가 앉았어.", tag: "stay" },
      { key: "back", text: "정류장을 두 번 왕복했어.", tag: "walk" },
      { key: "bus", text: "버스가 서고 떠나는 걸 지켜봤어.", tag: "look" },
    ],
    sights: [
      { key: "feet", text: "다들 발이 바빴어." },
      { key: "point", text: "누가 버스를 놓쳤어." },
      { key: "door", text: "버스 문이 두 번 열렸어." },
    ],
  },
  {
    key: "store",
    stage: 3,
    where: "편의점 앞",
    text: "편의점 앞을 지났어.",
    deeds: [
      { key: "inside", text: "문이 열릴 때 안을 들여다봤어.", tag: "look" },
      { key: "thrice", text: "앞을 세 번 왕복했어.", tag: "walk" },
      { key: "glass", text: "유리에 비친 나를 봤어.", tag: "look" },
      { key: "smellin", text: "문 앞 냄새를 맡아봤어.", tag: "smell" },
    ],
    sights: [
      { key: "song", text: "안에서 노랫소리가 조그맣게 났어." },
      { key: "bag", text: "봉투를 든 사람이 나왔어." },
      { key: "cold", text: "문 열릴 때마다 찬 바람이 나왔어." },
    ],
  },
  {
    key: "library",
    stage: 3,
    where: "도서관 앞",
    text: "도서관 앞까지 갔어.",
    deeds: [
      { key: "steps", text: "계단 끝까지 올라갔어.", tag: "walk" },
      { key: "sit", text: "계단에 앉아 있었어.", tag: "stay" },
      { key: "nose", text: "유리문에 코를 붙여 봤어.", tag: "touch" },
      { key: "count", text: "나오는 사람을 세어봤어.", tag: "look" },
    ],
    sights: [
      { key: "silent", text: "안이 아주 조용했어." },
      { key: "books", text: "책을 안은 사람이 지나갔어." },
      { key: "shade", text: "그늘이 계단까지 내려와 있었어." },
    ],
  },
  {
    key: "market",
    stage: 3,
    where: "시장 골목",
    text: "시장 골목에 들어갔어.",
    deeds: [
      { key: "follow", text: "냄새를 따라 끝까지 갔어.", tag: "smell" },
      { key: "boxes", text: "상자 사이를 지나가 봤어.", tag: "walk" },
      { key: "wetfloor", text: "물 뿌린 바닥을 밟았어.", tag: "touch" },
      { key: "crowd", text: "붐비는 걸 구경했어.", tag: "look" },
    ],
    sights: [
      { key: "mixed", text: "상자마다 다른 게 담겨 있었어." },
      { key: "seller", text: "상인이 물건을 옮기고 있었어." },
      { key: "damp", text: "바닥이 아직 젖어 있었어." },
    ],
  },

  // ── 4단계: 멀리. 사람과 닿아도 아무것도 요구받지 않는다 ──
  {
    key: "river",
    stage: 4,
    where: "강가",
    text: "강가에 닿았어.",
    deeds: [
      { key: "splash", text: "물에 들어가서 첨벙거렸어.", tag: "water" },
      { key: "along", text: "강을 따라 끝까지 걸었어.", tag: "walk" },
      { key: "prints", text: "젖은 모래에 발자국을 길게 남겼어.", tag: "walk" },
      { key: "watch", text: "물 위로 지나가는 걸 눈으로 따라갔어.", tag: "look" },
    ],
    sights: [
      { key: "skip", text: "누가 던진 돌이 물 위를 세 번 튀었어." },
      { key: "fisher", text: "낚시하는 사람이 멀리 있었어." },
      { key: "ducks", text: "오리 몇 마리가 줄지어 갔어." },
    ],
  },
  {
    key: "beach",
    stage: 4,
    where: "바닷가",
    text: "바다가 보이는 데까지 갔어.",
    deeds: [
      { key: "toWave", text: "파도까지 뛰어갔다 돌아왔어.", tag: "walk" },
      { key: "draw", text: "모래에 큼직하게 그림을 그렸어.", tag: "touch" },
      { key: "in", text: "물에 들어가서 파도를 맞았어.", tag: "water" },
      { key: "line", text: "수평선을 한참 봤어.", tag: "look" },
    ],
    sights: [
      { key: "shells", text: "조개껍데기가 흩어져 있었어." },
      { key: "gull", text: "갈매기가 낮게 날았어." },
      { key: "sand", text: "모래가 발가락 사이로 들어왔어." },
    ],
  },
  {
    key: "downtown",
    stage: 4,
    where: "큰길",
    text: "사람 많은 길을 지나왔어.",
    deeds: [
      { key: "through", text: "사람들 사이를 끝까지 지나갔어.", tag: "walk" },
      { key: "food", text: "맛있는 냄새 나는 데를 찾아갔어.", tag: "smell" },
      { key: "neon", text: "불빛을 한참 올려다봤어.", tag: "look" },
      { key: "window", text: "유리창에 발을 대 봤어.", tag: "touch" },
    ],
    sights: [
      { key: "smile", text: "누가 나를 보고 웃었어." },
      { key: "sign", text: "간판 불빛이 물에 비친 것처럼 흔들렸어." },
      { key: "music", text: "음악이 가게마다 달랐어." },
    ],
  },
  {
    key: "station",
    stage: 4,
    where: "기차역",
    text: "기차역에 들어가 봤어.",
    deeds: [
      { key: "board", text: "전광판 글자가 바뀌는 걸 지켜봤어.", tag: "look" },
      { key: "platform", text: "승강장까지 걸어갔어.", tag: "walk" },
      { key: "bench", text: "벤치에 올라가 앉았어.", tag: "stay" },
      { key: "wind", text: "기차 지나가는 바람을 맞았어.", tag: "touch" },
    ],
    sights: [
      { key: "train", text: "기차가 한 대 들어왔다 나갔어." },
      { key: "wheels", text: "캐리어 끄는 소리가 났어." },
      { key: "nobody", text: "아무도 나를 안 물어봤어." },
    ],
  },
  {
    key: "view",
    stage: 4,
    where: "높은 데",
    text: "높은 데까지 올라갔어.",
    deeds: [
      { key: "top", text: "끝까지 올라가서 아래를 봤어.", tag: "walk" },
      { key: "wind", text: "바람을 맞고 서 있었어.", tag: "stay" },
      { key: "home", text: "우리 집 쪽을 찾아봤어.", tag: "look" },
      { key: "rail", text: "난간에 발을 올려 봤어.", tag: "touch" },
    ],
    sights: [
      { key: "small", text: "집들이 다 작아 보였어." },
      { key: "gust", text: "바람이 계속 세게 불었어." },
      { key: "far", text: "멀리까지 다 보였어." },
    ],
  },
]

/**
 * **더 쓰지 않는다.** 2026-08-26 5축 전환으로 "만난 것"이 장소별 `sights`로 옮겨졌다.
 * 여기 남겨 둔 이유는 옛 `PetOuting.metKey` 행이 아직 있어서다 — 스키마가 `legs`로 바뀌기
 * 전까지 `outingEpisode()`가 그 키를 읽는다. 마이그레이션이 들어가면 이 배열을 지운다.
 */
export const OUTING_MET_LEGACY = [
  { key: "cat", text: "고양이 한 마리가 나를 쳐다봤어." },
  { key: "dog", text: "낮잠 자는 강아지 옆을 조용히 지나갔어." },
  { key: "granny", text: "빨래 걷는 할머니가 계셨어." },
  { key: "flower", text: "이름 모를 꽃이 피어 있었어." },
  { key: "tree", text: "나보다 훨씬 큰 나무가 있었어." },
  { key: "stranger", text: "종이봉투를 든 사람이 지나갔어." },
] as const

/**
 * 돌아와서의 기분. **독립 축이다** — 어떤 여행에도 붙어야 하므로 장소·사건을 언급하지 않는다.
 *
 * **평가도 교훈도 없다.** "너도 할 수 있어" 같은 말을 넣지 않는다 — 격려는 사용자를
 * 격려받아야 하는 위치에 세운다. 펫은 자기 얘기만 한다.
 *
 * `또 가고 싶어`류도 넣지 않는다. 외출은 친밀도 200이 든다 — 펫이 또 가고 싶다고 하면
 * 사용자에게 지출 압박이 된다.
 *
 * `별일은 없었어`가 실패 여지다. 매번 뭔가 있었다고 하면 아무 일 없는 날이 결함으로 읽힌다.
 */
export const OUTING_MOODS = [
  { key: "good", text: "그냥 좋았어." },
  { key: "scared", text: "조금 무서웠는데 해보니까 괜찮았어." },
  { key: "blank", text: "아무 생각도 안 났어." },
  { key: "long", text: "계속 보고 있었어." },
  { key: "missyou", text: "돌아오는 길에 네 생각이 났어." },
  { key: "tired", text: "좀 피곤해서 오는 길에 하품했어." },
  { key: "quiet", text: "조용해서 좋았어." },
  { key: "nothing", text: "별일은 없었어." },
] as const

/**
 * 여행일기의 첫 줄. 그날 간 **가장 먼 장소의 stage**로 갈린다 — 전체에 제목 역할을 한다.
 * 도입이 없으면 기분 한 줄이 마무리를 다 짊어진다.
 */
export const OUTING_OPENERS: Record<number, readonly string[]> = {
  2: ["오늘은 문 밖까지만 나갔어.", "멀리는 못 갔어. 그래도 나갔다 왔어."],
  3: ["오늘은 동네를 좀 돌았어.", "동네 쪽으로 한 바퀴 다녀왔어."],
  4: ["오늘은 좀 멀리 나갔어.", "오늘은 꽤 걸었어."],
}

/**
 * 장소 사이의 이동. **이게 없으면 문단이 순간이동한다** — 조합 방식이 리스트처럼 읽히던
 * 가장 큰 원인이었다.
 *
 * `돌아오는 길에`를 일부러 넣지 않았다 — 기분 문장 `돌아오는 길에 네 생각이 났어`와 겹친다.
 */
export const OUTING_LEAD_FIRST = ["먼저 ", "일단 ", ""] as const
export const OUTING_LEAD_MID = [
  "거기서 나와서 ",
  "한참 걷다가 ",
  "조금 더 가서 ",
  "그다음엔 ",
] as const
export const OUTING_LEAD_LAST = ["마지막으로 ", "돌아오기 전에 "] as const

export const OUTING_AWAY_LINES = [
  { key: "left", text: "방금 나갔어. 잘 다녀올게." },
  { key: "midway", text: "지금 {where}쯤이야." },
  { key: "back", text: "이제 돌아가는 중이야." },
] as const

export type OutingPlaceKey = (typeof OUTING_PLACES)[number]["key"]
export type OutingMoodKey = (typeof OUTING_MOODS)[number]["key"]

/** 외출 한 번에 다녀오는 장소 수. 4곳 이상이면 일기가 카드를 넘긴다 */
export const OUTING_LEGS_MIN = 2
export const OUTING_LEGS_MAX = 3

/** 외출이 열리는 최소 진화 단계. **1단계(알)는 나가지 않는다**(2026-08-26 사용자 결정) */
export const OUTING_MIN_STAGE = 2

/** 최근 이 횟수만큼의 (장소·사건) 조합을 피한다. `pickReview()`의 LRU와 같은 장치다 */
export const OUTING_RECENT_AVOID = 30

/**
 * 4단계 기준 변동폭. 한 장소 안에서 사건 4 × 결과 3 = 12, 만난것 3 → 36가지.
 * 3곳이면 C(15,3) 455 × 36³ × 기분 8 ≈ 1.7억이다.
 */
export const OUTING_COMBINATIONS =
  OUTING_PLACES.length * 4 * 3 * 3 * OUTING_MOODS.length

/**
 * 그 진화 단계에서 갈 수 있는 장소.
 *
 * **1단계는 빈 배열이다** — 나갈 수 없다는 것이 데이터로 드러나야 호출부가 실수하지 않는다.
 * 전에는 "최소 1곳은 나온다"로 클램프했는데, 그러면 알이 창가에 나가는 것이 정상처럼 보인다.
 */
export function outingPlacesForStage(stage: number): readonly (typeof OUTING_PLACES)[number][] {
  const s = Math.floor(stage)
  if (s < OUTING_MIN_STAGE) return []
  return OUTING_PLACES.filter((p) => p.stage <= s)
}

/** 진화 단계가 외출을 열 수 있는지. 화면과 API가 같은 판정을 쓴다 */
export function canGoOuting(stage: number): boolean {
  return outingPlacesForStage(stage).length >= OUTING_LEGS_MIN
}

/**
 * 아직 나갈 수 없을 때 쓰는 문장. **화면과 API가 같은 문자열을 쓴다.**
 *
 * 2026-08-26 사용자 결정으로 1단계에도 카드가 **보이되 잠긴 상태**가 됐다. 그러면
 * 이 문장이 두 곳에서 나간다 — 잠긴 버튼을 눌렀을 때(화면)와, 그 판정을 우회해
 * POST가 들어왔을 때(`lib/outing.ts` `PET_TOO_YOUNG`)다. 두 곳에 손으로 적으면
 * 한쪽만 다듬어져 같은 상황에 다른 말을 하게 된다.
 *
 * 레벨을 상수에서 만든다 — `EVOLUTION_LEVEL.STAGE2`가 바뀌면 문장도 따라간다.
 * `아기`는 진화 단계 이름이고 정본은 `PetView`의 `STAGE_NAME`이지만, 그쪽은 화면
 * 전용 배열이라 여기서 참조하면 lib가 컴포넌트를 의존한다. 이름 하나는 여기 적고
 * `check:pet`이 두 값이 어긋나는 것을 막는다.
 *
 * 명령형을 쓰지 않는다("씨앗을 먹이세요"). 미션 문구와 같은 규칙이다 — 못 하는 것을
 * 알릴 때 지시를 붙이면 그 자리가 과제가 된다.
 */
export const OUTING_LOCK_MESSAGE = `아기(Lv.${EVOLUTION_LEVEL.STAGE2})가 되면 밖에 나갈 수 있어요`

/** 잠긴 카드 각주의 왼쪽 줄. 위 문장보다 짧아야 한 줄에 들어온다 */
export const OUTING_LOCK_FOOT = "지금은 알이라 방에서 지내요"

/** 한 장소에서 한 일. DB에 저장하는 단위다 — 문장이 아니라 키만 담는다 */
export type OutingLeg = {
  place: string
  deed: string
  /** 결과 문장의 인덱스(0~2). 유형은 deed에서 파생되므로 저장하지 않는다 */
  result: number
  sight: string
}

/** 최근 회피에 쓰는 조합 키. 장소가 아니라 **(장소·사건)** 쌍이 단위다 */
export function outingComboKey(leg: { place: string; deed: string }): string {
  return `${leg.place}/${leg.deed}`
}

/**
 * 외출을 뽑는다. `rand`를 주입받는 이유는 `check:pet`이 경계를 고정하고 녹화에서 원하는
 * 결과를 만들 수 있어야 하기 때문이다 — 커리큘럼이 무작위를 안 쓰는 것과 같은 판단이다.
 *
 * @param recent 최근 외출들의 `outingComboKey()` 목록. 여기 있는 (장소·사건)은 피한다.
 *   후보가 전부 걸리면 회피를 포기한다 — 회피 때문에 외출이 실패하면 안 된다.
 */
export function rollOutingLegs(
  stage: number,
  rand: () => number = Math.random,
  recent: readonly string[] = [],
): OutingLeg[] {
  const pool = outingPlacesForStage(stage)
  if (pool.length < OUTING_LEGS_MIN) return []

  const pickIndex = (n: number) => Math.min(n - 1, Math.floor(rand() * n))
  const avoid = new Set(recent)

  // 장소 수를 먼저 정하고, 후보에서 겹치지 않게 뽑는다
  const want = Math.min(
    pool.length,
    OUTING_LEGS_MIN + pickIndex(OUTING_LEGS_MAX - OUTING_LEGS_MIN + 1),
  )
  const rest = [...pool]
  const chosen: (typeof OUTING_PLACES)[number][] = []
  while (chosen.length < want && rest.length > 0) {
    chosen.push(...rest.splice(pickIndex(rest.length), 1))
  }
  // 가까운 곳 → 먼 곳 순으로 세운다. 여행 경로처럼 읽힌다
  chosen.sort((a, b) => a.stage - b.stage || OUTING_PLACES.indexOf(a) - OUTING_PLACES.indexOf(b))

  const legs = chosen.map((place) => {
    const fresh = place.deeds.filter((d) => !avoid.has(outingComboKey({ place: place.key, deed: d.key })))
    const deeds = fresh.length > 0 ? fresh : place.deeds
    const deed = deeds[pickIndex(deeds.length)]
    const sight = place.sights[pickIndex(place.sights.length)]
    return {
      place: place.key,
      deed: deed.key,
      result: pickIndex(OUTING_RESULTS[deed.tag].length),
      sight: sight.key,
    }
  })

  // **한 외출이 전부 ③(담담·미완)이 되지 않게 한다.**
  //
  // 결과는 유형마다 ① 해냈다 ② 좋았다 ③ 담담 순이고 leg마다 독립으로 뽑는다. 그래서 2곳이면
  // 1/9(약 11%)이 전부 ③이 된다 — 실측에서 실제로 나왔다:
  //   "무슨 냄새인지는 몰랐어" + "오래 봤는데 잘 모르겠더라" + 기분 "계속 보고 있었어"
  // 세 박자가 다 시들하면 친밀도 200을 태운 값이 안 보인다(보람이 사라진다).
  //
  // ③을 없애지 않는다 — 그것이 실패 여지다. **전부 ③인 경우에만** 한 곳을 ①/②로 올린다.
  // 어느 곳을 올릴지는 rand에서 파생시킨다(같은 seed면 같은 결과여야 한다).
  const FLAT = 2
  if (legs.length > 0 && legs.every((l) => l.result === FLAT)) {
    const lift = pickIndex(legs.length)
    legs[lift].result = pickIndex(FLAT) // 0(해냈다) 또는 1(좋았다)
  }

  return legs
}

/**
 * 여행일기를 문단 배열로 조립한다. **한 원소가 한 문단이다** — 화면이 원소 단위로 그리므로
 * 줄 나열이 아니라 글로 읽힌다.
 *
 *   [0]      도입 한 줄
 *   [1..n]   장소마다 한 문단 (이동 + 장소 + 사건 + 결과 + 만난것)
 *   [마지막] 기분 한 줄
 *
 * 알 수 없는 키가 오면 그 조각만 빠지고 죽지 않는다(옛 기록·수동 수정).
 */
export function outingDiary(legs: readonly OutingLeg[], moodKey: string): string[] {
  const resolved = legs
    .map((leg) => {
      const place = OUTING_PLACES.find((p) => p.key === leg.place)
      if (!place) return null
      const deed = place.deeds.find((d) => d.key === leg.deed)
      const sight = place.sights.find((x) => x.key === leg.sight)
      const results = deed ? OUTING_RESULTS[deed.tag] : null
      const result = results ? results[Math.min(results.length - 1, Math.max(0, leg.result))] : null
      return { place, deed, sight, result }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (resolved.length === 0) return []

  const pick = <T,>(pool: readonly T[], seed: number): T => pool[seed % pool.length]
  // 문장을 저장하지 않으므로 전환어도 저장하지 않는다. 대신 legs에서 파생시켜
  // **같은 기록이면 항상 같은 일기가 나오게** 한다 — 새로고침에 문장이 바뀌면 안 된다
  const seed = resolved.reduce((n, r) => n + r.place.key.length + (r.deed?.key.length ?? 0), 0)

  const farthest = Math.max(...resolved.map((r) => r.place.stage))
  const openers = OUTING_OPENERS[farthest] ?? OUTING_OPENERS[2]
  const out = [pick(openers, seed)]

  resolved.forEach((r, i) => {
    const last = i === resolved.length - 1
    const lead =
      i === 0
        ? pick(OUTING_LEAD_FIRST, seed)
        : last && resolved.length >= 3
          ? pick(OUTING_LEAD_LAST, seed + i)
          : pick(OUTING_LEAD_MID, seed + i)
    const parts = [`${lead}${r.place.text}`, r.deed?.text, r.result, r.sight?.text]
    out.push(parts.filter((t): t is string => Boolean(t)).join(" "))
  })

  const mood = OUTING_MOODS.find((m) => m.key === moodKey)
  if (mood) out.push(mood.text)
  return out
}

/**
 * **옛 기록 전용.** 스키마가 `placeKey`/`metKey`/`moodKey` 세 컬럼이던 시절의 조립이다.
 * `legs` 마이그레이션이 들어가면 이 함수와 `OUTING_MET_LEGACY`를 함께 지운다.
 * 새 경로는 `outingDiary(legs, moodKey)`다.
 */
export function outingEpisode(
  placeKey: string,
  metKey: string,
  moodKey: string,
): string[] {
  const place = OUTING_PLACES.find((p) => p.key === placeKey)
  // metKey는 두 세대가 섞여 있다 — 옛 행은 전역 MET 키, 5축 전환 뒤 행은 그 장소의 sight 키다.
  // 장소 쪽을 먼저 본다(새 것이 우선). 둘 다 없으면 그 줄만 빠진다
  const met =
    place?.sights.find((x) => x.key === metKey) ??
    OUTING_MET_LEGACY.find((m) => m.key === metKey)
  const mood = OUTING_MOODS.find((m) => m.key === moodKey)
  // 풀이 `as const`라 text가 리터럴 유니온이다. string으로 넓혀 두지 않으면
  // 아래 타입 술어(t is string)가 파라미터 타입에 assignable하지 않아 tsc가 막는다
  const lines: (string | undefined)[] = [place?.text, met?.text, mood?.text]
  return lines.filter((t): t is string => Boolean(t))
}

/** 화면과 API가 같은 판정을 쓴다. 조건을 두 벌로 만들지 않는다 */
export type OutingState = "IDLE" | "AWAY" | "RETURNED"

/**
 * PetOuting 행 대신 필요한 두 필드만 받는다. **Prisma 모델을 import하지 않는 것은 의도다** —
 * 마이그레이션이 적용되기 전에도 이 함수와 check:pet이 돌아가야 한다.
 */
export type OutingLike = { returnsAt: Date; claimedAt: Date | null }

export function outingState(o: OutingLike | null, now: Date): OutingState {
  if (!o) return "IDLE"
  // 수령이 끝난 외출은 없는 것과 같다 — 다음 외출을 보낼 수 있다
  if (o.claimedAt) return "IDLE"
  return now.getTime() < o.returnsAt.getTime() ? "AWAY" : "RETURNED"
}

/**
 * 복귀까지 남은 밀리초. AWAY 카드의 "N시간 M분 뒤"에 쓴다.
 * 이미 지났거나 외출이 없으면 0이다 (음수를 내보내지 않는다).
 */
export function outingRemainingMs(o: OutingLike | null, now: Date): number {
  if (!o || o.claimedAt) return 0
  return Math.max(0, o.returnsAt.getTime() - now.getTime())
}

/**
 * 남은 시간을 사람이 읽는 한 줄로 만든다. 화면 두 곳(카드 제목·진행 게이지)이 같은
 * 문자열을 써야 하므로 순수 함수로 둔다 — 컴포넌트마다 따로 만들면 표기가 갈린다.
 *
 * 분 단위로 올림한다. 남은 30초를 "0분"으로 쓰면 다 됐는데 안 온 것처럼 읽힌다.
 */
export function outingRemainingLabel(ms: number): string {
  if (ms <= 0) return "곧 도착"
  const totalMin = Math.ceil(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h}시간 ${m}분`
  if (h > 0) return `${h}시간`
  return `${m}분`
}

/** 진행 비율 계산에는 시작 시각이 더 필요하다. outingState는 이 필드를 요구하지 않는다 */
export type OutingProgressLike = OutingLike & { startedAt: Date }

/**
 * 0~1 사이의 경과 비율. 게이지와 3막 판정이 같은 값을 쓴다.
 *
 * OUTING_MS로 나누지 않고 **행의 startedAt~returnsAt 폭으로 나눈다** — 나중에
 * OUTING_HOURS를 바꿔도 이미 나가 있는 외출의 게이지가 어긋나지 않는다.
 */
export function outingProgress(o: OutingProgressLike | null, now: Date): number {
  if (!o) return 0
  if (o.claimedAt) return 1
  const span = o.returnsAt.getTime() - o.startedAt.getTime()
  if (span <= 0) return 1
  const elapsed = now.getTime() - o.startedAt.getTime()
  return Math.min(1, Math.max(0, elapsed / span))
}

/**
 * 나가 있는 동안 방에 남는 한 줄. 경과 3분의 1마다 바뀐다.
 *
 * 알 수 없는 placeKey면 `{where}` 자리를 "밖"으로 둔다 — 옛 기록이나 손으로 고친 행에서
 * 치환되지 않은 `{where}`가 화면에 그대로 나오는 것을 막는다.
 */
export function outingAwayLine(placeKey: string, progress: number): string {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const act = p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2
  const where = OUTING_PLACES.find((x) => x.key === placeKey)?.where ?? "밖"
  return OUTING_AWAY_LINES[act].text.replace("{where}", where)
}
