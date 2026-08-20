import { getCurrentUserWithSkin } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import { completeMission } from "@/lib/missions/completion"
import { getTodayKey } from "@/lib/missions/reset"
import { getStageProgress } from "@/lib/missions/stages"

export async function POST(req: Request, { params }: { params: Promise<{ missionId: string }> }) {
  try {
    const { missionId } = await params
    const user = await getCurrentUserWithSkin()

    if (!user.typeCode) {
      return fail("DIAGNOSIS_NOT_COMPLETED", "진단을 먼저 완료해주세요", 400)
    }

    const mission = await prisma.mission.findUnique({ where: { id: missionId } })
    if (!mission) {
      return fail("MISSION_NOT_FOUND", "미션을 찾을 수 없습니다", 404)
    }

    // 사진 미션은 일반 완료 API에서 거절
    if (mission.requiresPhoto) {
      return fail("PHOTO_REQUIRED", "사진 미션은 /api/upload/verify에서 완료해주세요", 400)
    }

    // 이벤트 미션은 completeMissionByCode()로만 완료
    if (mission.code === "DAILY_COMMUNITY_POST" || mission.code === "DAILY_CHAT") {
      return fail("EVENT_MISSION", "이 미션은 활동 완료 시 자동으로 반영됩니다", 400)
    }

    // 단계 미션 해금 확인
    if (mission.scope === "STAGE") {
      const stageProgress = await getStageProgress(user.id, user.typeCode)
      const currentStage = stageProgress.find((sp) => sp.stage === mission.stage)

      if (!currentStage?.unlocked) {
        return fail("STAGE_LOCKED", "이전 단계를 먼저 완료해주세요", 400)
      }
    }

    // resetKey 결정
    const resetKey = mission.scope === "DAILY" ? getTodayKey() : "STAGE"

    const result = await completeMission({
      actor: user,
      missionId,
      resetKey,
    })

    return ok(result)
  } catch (err) {
    if (err instanceof Error && err.message === "로그인이 필요합니다") {
      return fail("UNAUTHORIZED", err.message, 401)
    }
    console.error("POST /api/missions/[missionId]/complete error:", err)
    return fail("INTERNAL_ERROR", "미션 완료 중 오류가 발생했습니다", 500)
  }
}
