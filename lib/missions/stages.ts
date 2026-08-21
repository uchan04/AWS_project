import type { TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type StageProgress = {
  stage: number
  unlocked: boolean
  completedCount: number
  requiredForNextStage: number
}

/**
 * 단계별 해금 상태와 완료 수 계산.
 * 단계 1은 항상 해금.
 * 이후 단계는 바로 이전 단계 4개 중 3개 이상 완료 시 해금.
 */
export async function getStageProgress(userId: string, typeCode: TypeCode): Promise<StageProgress[]> {
  const stages = [1, 2, 3]

  // 전체 단계 미션 한 번에 조회
  const allMissions = await prisma.mission.findMany({
    where: { scope: "STAGE", typeCode, stage: { in: stages } },
    select: { id: true, stage: true },
  })

  const missionIds = allMissions.map((m) => m.id)

  // 전체 완료 기록 한 번에 조회
  const completions = await prisma.userMission.findMany({
    where: {
      userId,
      missionId: { in: missionIds },
      resetKey: "STAGE",
    },
    select: { missionId: true },
  })

  const completedIds = new Set(completions.map((c) => c.missionId))

  const result: StageProgress[] = []

  for (const stage of stages) {
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
