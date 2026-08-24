import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"

/**
 * 무산 알림 읽음 처리.
 *
 * where에 userId: user.id가 박혀 있어 본인 행만 갱신된다 — 남의 meetupId를 섞어 보내도
 * 그 사람의 알림은 건드려지지 않는다. canceledAt: null · notifiedCancelAt: null 조건은
 * 조회(_lib/notice.ts)와 같은 것을 쓴다. 두 조건이 어긋나면 안 보여준 알림이 읽음이 된다.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const payload = await request.json().catch(() => null)
    // 문자열이 아닌 원소는 걸러낸다. 그대로 in에 넣으면 쿼리 단계에서 터진다.
    const meetupIds = Array.isArray(payload?.meetupIds)
      ? payload.meetupIds.filter((id: unknown): id is string => typeof id === "string")
      : null
    if (!meetupIds || meetupIds.length === 0) {
      return fail("INVALID_BODY", "확인할 알림이 없어요", 400)
    }

    const updated = await prisma.meetupParticipant.updateMany({
      where: {
        userId: user.id,
        meetupId: { in: meetupIds },
        canceledAt: null,
        notifiedCancelAt: null,
      },
      data: { notifiedCancelAt: new Date() },
    })

    return ok({ count: updated.count })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
