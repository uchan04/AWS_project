import { getCurrentUser } from "@/lib/auth"
import { ok, fail } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import { generatePresignedUrl } from "@/lib/missions/upload"

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    const { missionId, contentType, fileSize } = body

    if (!missionId || !contentType || !fileSize) {
      return fail("INVALID_INPUT", "필수 정보가 누락되었습니다", 400)
    }

    const mission = await prisma.mission.findUnique({ where: { id: missionId } })
    if (!mission) {
      return fail("MISSION_NOT_FOUND", "미션을 찾을 수 없습니다", 404)
    }

    if (!mission.requiresPhoto) {
      return fail("PHOTO_NOT_REQUIRED", "사진이 필요하지 않은 미션입니다", 400)
    }

    // TODO: 단계 해금 확인 추가 가능

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
