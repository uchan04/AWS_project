import { getCurrentUserWithSkin } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import { verifyS3Object } from "@/lib/missions/upload"
import { verifyMissionPhoto } from "@/lib/missions/vision"
import { completeMission } from "@/lib/missions/completion"
import { getTodayKey } from "@/lib/missions/reset"
import { getStageProgress } from "@/lib/missions/stages"

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithSkin()
    const body = await req.json()

    const { missionId, s3Key } = body

    if (!missionId || !s3Key) {
      return fail("INVALID_INPUT", "필수 정보가 누락되었습니다", 400)
    }

    if (!user.typeCode) {
      return fail("DIAGNOSIS_NOT_COMPLETED", "진단을 먼저 완료해주세요", 400)
    }

    const mission = await prisma.mission.findUnique({ where: { id: missionId } })
    if (!mission) {
      return fail("MISSION_NOT_FOUND", "미션을 찾을 수 없습니다", 404)
    }

    if (!mission.requiresPhoto) {
      return fail("PHOTO_NOT_REQUIRED", "사진이 필요하지 않은 미션입니다", 400)
    }

    // 단계 미션 해금 확인
    if (mission.scope === "STAGE") {
      const stageProgress = await getStageProgress(user.id, user.typeCode)
      const currentStage = stageProgress.find((sp) => sp.stage === mission.stage)

      if (!currentStage?.unlocked) {
        return fail("STAGE_LOCKED", "이전 단계를 먼저 완료해주세요", 400)
      }
    }

    // S3 객체 확인
    await verifyS3Object({
      s3Key,
      userId: user.id,
      missionId,
    })

    // Nova 판정
    const visionResult = await verifyMissionPhoto({
      s3Key,
      missionDescription: mission.description,
    })

    if (!visionResult.passed) {
      return ok({
        passed: false,
        reason: visionResult.reason,
        completed: false,
      })
    }

    // 판정 통과 → 미션 완료
    const resetKey = mission.scope === "DAILY" ? getTodayKey() : "STAGE"

    const completionResult = await completeMission({
      actor: user,
      missionId,
      resetKey,
      photoKey: s3Key,
    })

    return ok({
      passed: true,
      reason: visionResult.reason,
      completed: completionResult.newlyCompleted,
      reward: completionResult.reward,
    })
  } catch (err: any) {
    if (err.message === "로그인이 필요합니다") {
      return fail("UNAUTHORIZED", err.message, 401)
    }
    if (err.message.includes("S3") || err.message.includes("파일")) {
      return fail("INVALID_FILE", err.message, 400)
    }
    console.error("POST /api/upload/verify error:", err)
    return fail("INTERNAL_ERROR", err.message || "사진 검증 중 오류가 발생했습니다", 500)
  }
}
