// 소유자: C. 펫 외출의 DB 경로. (SPEC.md 5절, 계획은 docs/dev/pet.md "펫 외출 시스템")
//
// 값과 문구와 판정은 전부 lib/pet.ts 외출 절에 있다. 이 파일은 그것을 읽어 DB에 쓰고,
// 화면 세 상태가 쓸 한 덩어리(OutingView)로 만들어 준다. 계산을 여기서 다시 하지 않는다 —
// 두 벌이 되면 화면과 API의 판정이 갈린다.
//
// 화면(app/pet/page.tsx)과 API(app/api/pet/outing/)가 같은 함수를 부른다.

import type { PetOuting, PetSkin } from "@prisma/client"
import {
  OUTING_COST_AFFINITY,
  OUTING_HOURS,
  OUTING_MS,
  OUTING_MOODS,
  type OutingState,
  outingAwayLine,
  outingEpisode,
  outingPlacesForStage,
  outingProgress,
  outingRemainingLabel,
  outingRemainingMs,
  outingState,
  rollOutingReward,
} from "./pet"
import { prisma } from "./prisma"
import { calculateReward } from "./reward"

/** 화면 세 상태가 쓰는 한 덩어리. 시간에 따라 변하는 값은 서버 렌더 시각 기준이다 */
export type OutingView = {
  /**
   * PetOuting 표가 실제로 있는지. **false면 화면이 외출 카드를 아예 숨긴다.**
   *
   * 마이그레이션이 아직 공유 DB에 안 들어간 구간이 존재하고(팀 5인이 각자 pull한다),
   * 그때 이 표를 읽으면 P2021로 죽는다. 8/24에 develop 전체가 500이 된 것과 같은 모양이라
   * 여기서 잡아 카드 하나만 사라지게 한다. 마이그레이션이 적용되면 항상 true다.
   */
  available: boolean
  state: OutingState
  costAffinity: number
  hours: number

  // AWAY
  /** 클라이언트 카운트다운의 **절대** 기준. 남은 ms를 1초씩 빼는 방식은 배경 탭에서 멈춘다 */
  returnsAt: string | null
  remainingMs: number
  remainingLabel: string
  progress: number
  awayLine: string | null
  /**
   * 지금 가 있는 장소의 키. **문장이 아니라 키를 내려보내는 것이 의도다** — 화면이
   * outingAwayLine(placeKey, progress)를 다시 부를 수 있어야 4시간 동안 탭을 열어 둔
   * 사람에게도 소식이 1막 → 2막 → 3막으로 넘어간다. 아래 awayLine은 서버 렌더 시각의 값이라
   * 그것만 내려보내면 새로고침할 때까지 첫 줄에 멈춘다
   */
  placeKey: string | null

  // RETURNED
  episode: string[]
  /** 배율까지 얹은 **실지급 예정** 수량. 저장값(gotSeeds)이 아니라 이 숫자를 화면에 쓴다 */
  reward: { seeds: number; starShards: number } | null
}

const EMPTY: OutingView = {
  available: true,
  state: "IDLE",
  costAffinity: OUTING_COST_AFFINITY,
  hours: OUTING_HOURS,
  returnsAt: null,
  remainingMs: 0,
  remainingLabel: "",
  progress: 0,
  awayLine: null,
  placeKey: null,
  episode: [],
  reward: null,
}

/** 표가 아직 없다(P2021) / 컬럼이 없다(P2022). 그 외 에러는 삼키지 않고 그대로 올린다 */
function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === "P2021" || code === "P2022"
}

/**
 * 아직 안 받은 외출 1건. 부분 유니크 인덱스가 있으므로 1건을 넘을 수 없다.
 * **읽기만 한다** — /api/pet/idle의 GET이 그렇게 하는 것과 같은 규칙이다(조회에 쓰기를 섞지 않는다).
 */
export async function findOpenOuting(userId: string): Promise<PetOuting | null | "NO_TABLE"> {
  try {
    return await prisma.petOuting.findFirst({
      where: { userId, claimedAt: null },
      orderBy: { startedAt: "desc" },
    })
  } catch (error) {
    if (isMissingTable(error)) return "NO_TABLE"
    throw error
  }
}

/** 행 하나를 화면이 쓸 모양으로 옮긴다. 순수 함수라 API와 페이지가 같은 값을 본다 */
export function toOutingView(
  outing: PetOuting | null,
  skin: PetSkin | null,
  now: Date,
): OutingView {
  const state = outingState(outing, now)
  if (!outing || state === "IDLE") return EMPTY

  const remainingMs = outingRemainingMs(outing, now)
  const progress = outingProgress(outing, now)

  return {
    ...EMPTY,
    state,
    returnsAt: outing.returnsAt.toISOString(),
    remainingMs,
    remainingLabel: outingRemainingLabel(remainingMs),
    progress,
    awayLine: state === "AWAY" ? outingAwayLine(outing.placeKey, progress) : null,
    // AWAY에서만 준다. RETURNED에 넣으면 에피소드 첫 줄과 같은 장소를 두 번 말하게 된다
    placeKey: state === "AWAY" ? outing.placeKey : null,
    episode:
      state === "RETURNED"
        ? outingEpisode(outing.placeKey, outing.metKey, outing.moodKey)
        : [],
    reward:
      state === "RETURNED"
        ? {
            // 절대 규칙: 재화 증감은 calculateReward()만 통과한다. 화면에 미리 보여주는
            // 숫자도 같은 함수를 통과해야 실제 지급액과 맞는다 (배율이 붙는 스킨이 있다)
            seeds: calculateReward(skin, { seeds: outing.gotSeeds }).seeds ?? 0,
            starShards: calculateReward(skin, { starShards: outing.gotShards }).starShards ?? 0,
          }
        : null,
  }
}

/** 표가 없을 때의 뷰. 카드를 숨기는 것 말고는 IDLE과 같다 */
export function unavailableOutingView(): OutingView {
  return { ...EMPTY, available: false }
}

/** 한 번에 읽어서 뷰까지 만든다. 페이지와 GET이 같은 두 줄을 반복하지 않게 한다 */
export async function loadOutingView(
  userId: string,
  skin: PetSkin | null,
  now: Date,
): Promise<OutingView> {
  const open = await findOpenOuting(userId)
  if (open === "NO_TABLE") return unavailableOutingView()
  return toOutingView(open, skin, now)
}

export type StartOutingResult =
  | { ok: true; view: OutingView; affinity: number }
  | {
      ok: false
      code: "NOT_ENOUGH_AFFINITY" | "ALREADY_OUT" | "NO_TABLE" | "PET_TOO_YOUNG"
      message: string
    }

/**
 * 외출을 보낸다.
 *
 * **소모에는 calculateReward()를 쓰지 않는다** — /api/pet/feed와 스킨 구매와 같은 이유다.
 * 그 함수의 배율은 획득에만 붙는다. 소모에 걸면 효과 스킨을 쓰는 사람이 더 많이 낸다.
 *
 * 3축과 보상을 **보낼 때** 뽑아 저장한다. 복귀 때 뽑으면 새로고침마다 값이 바뀐다.
 *
 * 갈 수 있는 장소는 진화 단계로 좁힌다 — 펫이 자라면 범위가 밖으로 넓어진다.
 */
export async function startOuting(
  args: {
    userId: string
    skin: PetSkin | null
    evolutionStage: number
  },
  now: Date,
  rand: () => number = Math.random,
): Promise<StartOutingResult> {
  const places = outingPlacesForStage(args.evolutionStage)
  // 1단계(알)는 나가지 않는다(2026-08-26 사용자 결정). outingPlacesForStage가 빈 배열을
  // 주므로 여기서 막지 않으면 pick()이 undefined를 집는다
  if (places.length === 0) {
    return {
      ok: false,
      code: "PET_TOO_YOUNG",
      message: "펫이 한 번 자라면 밖에 나갈 수 있어요",
    }
  }

  const pick = <T>(pool: readonly T[]): T => pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]

  const place = pick(places)
  // 만난 것은 **그 장소의** sights에서 뽑는다. 전역 풀이던 시절에는 `부엌 / 빨래 걷는
  // 할머니가 계셨어` 같은 조합이 나왔다. 컬럼은 그대로 metKey를 쓴다 — legs 마이그레이션
  // 전까지의 다리다(lib/pet.ts outingEpisode 주석)
  const met = pick(place.sights)
  const mood = pick(OUTING_MOODS)
  const roll = rollOutingReward(rand)

  try {
    const created = await prisma.$transaction(async (tx) => {
      // 잔액 검사와 차감을 한 문장으로 한다. findUnique로 먼저 보고 나중에 빼면 그 사이에
      // 다른 탭이 먼저 써서 음수가 될 수 있다 (스킨 구매와 같은 패턴)
      const paid = await tx.user.updateMany({
        where: { id: args.userId, affinity: { gte: OUTING_COST_AFFINITY } },
        data: { affinity: { decrement: OUTING_COST_AFFINITY } },
      })
      if (paid.count === 0) return "NOT_ENOUGH_AFFINITY" as const

      // 여기서 부분 유니크 인덱스가 P2002를 던지면 트랜잭션이 롤백되어 **친밀도도 돌아온다.**
      // 순서가 반대(먼저 만들고 나중에 차감)면 그 보호가 없다
      return await tx.petOuting.create({
        data: {
          userId: args.userId,
          startedAt: now,
          returnsAt: new Date(now.getTime() + OUTING_MS),
          placeKey: place.key,
          metKey: met.key,
          moodKey: mood.key,
          gotSeeds: roll.seeds,
          gotShards: roll.starShards,
        },
      })
    })

    if (created === "NOT_ENOUGH_AFFINITY") {
      return {
        ok: false,
        code: "NOT_ENOUGH_AFFINITY",
        message: `친밀도가 ${OUTING_COST_AFFINITY} 필요해요`,
      }
    }

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: args.userId },
      select: { affinity: true },
    })

    return { ok: true, view: toOutingView(created, args.skin, now), affinity: after.affinity }
  } catch (error) {
    if (isMissingTable(error)) {
      return { ok: false, code: "NO_TABLE", message: "외출은 곧 열려요" }
    }
    // 부분 유니크 인덱스 위반. 보내기를 빠르게 두 번 누른 자리다
    if ((error as { code?: string }).code === "P2002") {
      return { ok: false, code: "ALREADY_OUT", message: "펫이 이미 밖에 나가 있어요" }
    }
    throw error
  }
}

export type ClaimOutingResult =
  | {
      ok: true
      episode: string[]
      gained: { seeds: number; starShards: number }
      seeds: number
      starShards: number
    }
  | { ok: false; code: "NOTHING_TO_CLAIM" | "STILL_AWAY" | "NO_TABLE"; message: string }

/**
 * 돌아온 펫의 이야기를 듣고 재화를 받는다.
 *
 * **복귀 지급을 조회에 섞지 않은 것은 의도다.** A의 계획은 ensureOutingReturn()을 페이지
 * 진입에서 부르는 pull 패턴이었는데, 그러면 지급과 동시에 claimedAt이 찍혀 상태가 IDLE이
 * 되고 **에피소드를 보여줄 렌더가 한 번뿐**이다(새로고침하면 이야기가 사라진다).
 * /api/pet/idle의 GET이 "조회에 쓰기를 섞지 않는다"고 못 박아 둔 규칙과도 어긋난다.
 *
 * 그래서 복귀는 상태로만 두고 지급은 이 함수(사용자가 누를 때)가 한다. 안 받은 외출이
 * 남아 있으면 부분 유니크 인덱스가 다음 외출을 막으므로 영구히 방치되지도 않는다 —
 * 들으러 와야 다음에 보낼 수 있다.
 */
export async function claimOuting(
  args: { userId: string; skin: PetSkin | null },
  now: Date,
): Promise<ClaimOutingResult> {
  try {
    const open = await prisma.petOuting.findFirst({
      where: { userId: args.userId, claimedAt: null },
      orderBy: { startedAt: "desc" },
    })
    if (!open) {
      return { ok: false, code: "NOTHING_TO_CLAIM", message: "받을 이야기가 없어요" }
    }
    if (outingState(open, now) !== "RETURNED") {
      return {
        ok: false,
        code: "STILL_AWAY",
        message: `아직 밖에 있어요 · ${outingRemainingLabel(outingRemainingMs(open, now))} 뒤`,
      }
    }

    // 절대 규칙: 지급은 calculateReward()만 통과한다 (CLAUDE.md 2절)
    const gained = calculateReward(args.skin, {
      seeds: open.gotSeeds,
      starShards: open.gotShards,
    })
    const seeds = gained.seeds ?? 0
    const starShards = gained.starShards ?? 0

    const result = await prisma.$transaction(async (tx) => {
      // claimedAt: null을 where에 넣어 낙관적 락으로 쓴다. 두 요청이 겹쳐도 두 번째는
      // count 0이 되어 이중 지급되지 않는다 (/api/pet/idle과 같은 패턴)
      const stamped = await tx.petOuting.updateMany({
        where: { id: open.id, claimedAt: null },
        data: { claimedAt: now },
      })
      if (stamped.count !== 1) return null

      return await tx.user.update({
        where: { id: args.userId },
        data: { seeds: { increment: seeds }, starShards: { increment: starShards } },
        select: { seeds: true, starShards: true },
      })
    })

    if (!result) {
      return { ok: false, code: "NOTHING_TO_CLAIM", message: "이미 받은 이야기예요" }
    }

    return {
      ok: true,
      episode: outingEpisode(open.placeKey, open.metKey, open.moodKey),
      gained: { seeds, starShards },
      seeds: result.seeds,
      starShards: result.starShards,
    }
  } catch (error) {
    if (isMissingTable(error)) {
      return { ok: false, code: "NO_TABLE", message: "외출은 곧 열려요" }
    }
    throw error
  }
}
