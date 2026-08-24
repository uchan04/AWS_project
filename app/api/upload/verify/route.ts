import { getCurrentUserWithSkin } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { verifyS3Object } from "@/lib/missions/upload"
import { verifyMissionPhoto } from "@/lib/missions/vision"
import { completeMission, loadCompletableMission } from "@/lib/missions/completion"
import { getTodayKey } from "@/lib/missions/reset"

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

    // 존재·소유 유형·커리큘럼 슬롯·단계 해금을 한 곳에서 본다 (loadCompletableMission 주석 참고)
    const loaded = await loadCompletableMission(user.id, user.typeCode, missionId)
    if (loaded.error) return loaded.error
    const mission = loaded.mission

    if (!mission.requiresPhoto) {
      return fail("PHOTO_NOT_REQUIRED", "사진이 필요하지 않은 미션입니다", 400)
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
      mission, // loadCompletableMission이 방금 읽은 행이다. 다시 읽지 않는다(왕복 1회 절약)
    })

    return ok({
      passed: true,
      reason: visionResult.reason,
      completed: completionResult.newlyCompleted,
      reward: completionResult.reward,
    })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "로그인이 필요합니다") {
        return fail("UNAUTHORIZED", err.message, 401)
      }
      if (err.message.includes("S3") || err.message.includes("파일")) {
        return fail("INVALID_FILE", err.message, 400)
      }
    }
    console.error("POST /api/upload/verify error:", err)
    const message = err instanceof Error ? err.message : "사진 검증 중 오류가 발생했습니다"
    return fail("INTERNAL_ERROR", message, 500)
  }
}
