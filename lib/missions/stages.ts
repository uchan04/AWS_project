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
  const result: StageProgress[] = []

  for (const stage of stages) {
    // 해당 단계 미션 조회
    const missions = await prisma.mission.findMany({
      where: { scope: "STAGE", typeCode, stage },
      select: { id: true },
    })

    // 완료 수 (resetKey = "STAGE"로 고정)
    const completedCount = await prisma.userMission.count({
      where: {
        userId,
        missionId: { in: missions.map((m) => m.id) },
        resetKey: "STAGE",
      },
    })

    // 해금 여부
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
