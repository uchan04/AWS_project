import type { TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type StageProgress = {
  stage: number
  unlocked: boolean
  completedCount: number
  requiredForNextStage: number
}

const STAGES = [1, 2, 3]

/**
 * 해금 계산의 순수 함수 판. DB를 읽지 않는다.
 * 미션 행과 완료 id를 이미 들고 있는 호출자(buildDashboard)가 같은 것을 다시 읽지 않게
 * 분리했다(2026-08-21 A). getStageProgress는 이 함수를 감싼 조회판이다.
 */
export function computeStageProgress(
  allMissions: { id: string; stage: number | null }[],
  completedIds: Set<string>
): StageProgress[] {
  const result: StageProgress[] = []

  for (const stage of STAGES) {
    const stageMissionIds = allMissions.filter((m) => m.stage === stage).map((m) => m.id)
    const completedCount = stageMissionIds.filter((id) => completedIds.has(id)).length

    let unlocked = stage === 1

    if (stage > 1 && result.length > 0) {
      const prev = result[result.length - 1]
      unlocked = prev.completedCount >= 3
    }

    result.push({
      stage,
      unlocked,
      completedCount,
      requiredForNextStage: 3,
    })
  }

  return result
}

/**
 * 단계별 해금 상태와 완료 수 계산.
 * 단계 1은 항상 해금.
 * 이후 단계는 바로 이전 단계 4개 중 3개 이상 완료 시 해금.
 *
 * 두 쿼리를 병렬로 낸다. 완료 기록은 missionId 목록에 의존하지 않고
 * 관계 필터(mission: {...})로 같은 집합을 고르므로 순차로 기다릴 이유가 없다.
 */
export async function getStageProgress(userId: string, typeCode: TypeCode): Promise<StageProgress[]> {
  const [allMissions, completions] = await Promise.all([
    prisma.mission.findMany({
      where: { scope: "STAGE", typeCode, stage: { in: STAGES } },
      select: { id: true, stage: true },
    }),
    prisma.userMission.findMany({
      where: { userId, resetKey: "STAGE", mission: { scope: "STAGE", typeCode, stage: { in: STAGES } } },
      select: { missionId: true },
    }),
  ])

  return computeStageProgress(allMissions, new Set(completions.map((c) => c.missionId)))
}
