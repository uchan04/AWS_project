import type { TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getStageMissionCatalog } from "./catalog"
import { MISSIONS_PER_STAGE, REQUIRED_PER_STAGE, TOTAL_STAGES } from "./bands"

export type StageProgress = {
  stage: number
  unlocked: boolean
  completedCount: number
  /** 이 단계에 놓인 미션 수. 보통 3이지만 DB가 덜 시드됐을 수도 있어 실제 값을 쓴다 */
  missionCount: number
  requiredForNextStage: number
}

/**
 * 해금 계산의 순수 함수 판. DB를 읽지 않는다.
 * 미션 행과 완료 id를 이미 들고 있는 호출자(buildDashboard)가 같은 것을 다시 읽지 않게
 * 분리했다(2026-08-21 A). getStageProgress는 이 함수를 감싼 조회판이다.
 *
 * 2026-08-22: 단계가 3개 → 100개가 되면서 stage마다 filter를 돌던 O(단계×미션) 루프를
 * 한 번의 그룹핑으로 바꿨다. 300미션 × 100단계 = 3만 번 비교를 매 요청마다 돌릴 이유가 없다.
 */
export function computeStageProgress(
  allMissions: { id: string; stage: number | null }[],
  completedIds: Set<string>
): StageProgress[] {
  const total = new Map<number, number>()
  const done = new Map<number, number>()

  for (const m of allMissions) {
    if (m.stage == null) continue
    total.set(m.stage, (total.get(m.stage) ?? 0) + 1)
    if (completedIds.has(m.id)) done.set(m.stage, (done.get(m.stage) ?? 0) + 1)
  }

  const result: StageProgress[] = []

  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    const missionCount = total.get(stage) ?? 0
    const completedCount = done.get(stage) ?? 0

    // 1단계는 항상 열려 있다. 이후는 바로 앞 단계에서 요구 수를 채웠는지만 본다.
    // 앞 단계를 통째로 다 하게 만들지 않는 이유: 오늘 못 하는 미션 하나가
    // 100단계 전체를 막으면 안 된다(사진 미션인데 나갈 수 없는 날 등)
    const prev = result[result.length - 1]
    const unlocked = stage === 1 ? true : (prev?.completedCount ?? 0) >= REQUIRED_PER_STAGE

    result.push({
      stage,
      unlocked,
      completedCount,
      missionCount: missionCount || MISSIONS_PER_STAGE,
      requiredForNextStage: REQUIRED_PER_STAGE,
    })
  }

  return result
}

/**
 * 지금 사용자가 서 있는 단계.
 *
 * "열려 있고 아직 요구 수를 못 채운 첫 단계"다. 100단계까지 다 채웠으면 100을 준다.
 * 화면은 이 단계를 기본으로 보여준다 — 100단계 캐러셀을 1단계부터 열면
 * 37단계 사용자가 화살표를 36번 눌러야 한다.
 */
export function currentStageOf(progress: StageProgress[]): number {
  const found = progress.find((p) => p.unlocked && p.completedCount < p.requiredForNextStage)
  return found?.stage ?? TOTAL_STAGES
}

/** 100단계까지 요구 수를 다 채웠는가. 졸업 카드 표시 조건 */
export function isGraduated(progress: StageProgress[]): boolean {
  const last = progress[progress.length - 1]
  return Boolean(last && last.unlocked && last.completedCount >= last.requiredForNextStage)
}

/**
 * 단계별 해금 상태와 완료 수 계산.
 *
 * 두 쪽을 병렬로 낸다. 완료 기록은 missionId 목록에 의존하지 않고
 * 관계 필터(mission: {...})로 같은 집합을 고르므로 순차로 기다릴 이유가 없다.
 *
 * 2026-08-23: 미션 쪽은 프로세스 내 캐시(./catalog.ts)에서 가져온다. 시드로만 바뀌는
 * 불변 데이터를 요청마다 다시 읽을 이유가 없다 — 계측 근거는 그 파일 주석에 있다.
 * 그래서 DB 왕복은 완료 기록 1회로 줄었다.
 *
 * order 상한(옛 시드가 남긴 단계당 4번째 미션 9개 배제)은 카탈로그 쪽에서 처리한다.
 * 정리하려면 scripts/prune-orphan-stage-missions.ts --apply
 */
export async function getStageProgress(userId: string, typeCode: TypeCode): Promise<StageProgress[]> {
  const [allMissions, completions] = await Promise.all([
    getStageMissionCatalog(typeCode),
    prisma.userMission.findMany({
      where: {
        userId,
        resetKey: "STAGE",
        mission: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
      },
      select: { missionId: true },
    }),
  ])

  return computeStageProgress(allMissions, new Set(completions.map((c) => c.missionId)))
}
