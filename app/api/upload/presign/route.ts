import { getCurrentUser } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { loadCompletableMission } from "@/lib/missions/completion"
import { generatePresignedUrl } from "@/lib/missions/upload"

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    const { missionId, contentType, fileSize } = body

    if (!missionId || !contentType || !fileSize) {
      return fail("INVALID_INPUT", "필수 정보가 누락되었습니다", 400)
    }

    // 완료 경로와 **같은** 검증을 태운다. findUnique(id)만 하면 남의 유형 미션이나
    // 잠긴 단계의 미션 id로도 presigned PUT URL이 나갔다 — 미션은 완료되지 않지만
    // 버킷에는 쓸 수 있다. 여기 있던 `// TODO: 단계 해금 확인 추가 가능`이 그 구멍이었다.
    if (!user.typeCode) {
      return fail("DIAGNOSIS_NOT_COMPLETED", "진단을 먼저 완료해주세요", 400)
    }

    const loaded = await loadCompletableMission(user.id, user.typeCode, missionId)
    if (loaded.error) return loaded.error

    if (!loaded.mission.requiresPhoto) {
      return fail("PHOTO_NOT_REQUIRED", "사진이 필요하지 않은 미션입니다", 400)
    }

    const result = await generatePresignedUrl({
      userId: user.id,
      missionId,
      contentType,
      fileSize,
    })

    return ok(result)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "로그인이 필요합니다") {
        return fail("UNAUTHORIZED", err.message, 401)
      }
      if (err.message.includes("허용되지 않은") || err.message.includes("초과")) {
        return fail("INVALID_FILE", err.message, 400)
      }
    }
    console.error("POST /api/upload/presign error:", err)
    return fail("INTERNAL_ERROR", "업로드 URL 생성 중 오류가 발생했습니다", 500)
  }
}
