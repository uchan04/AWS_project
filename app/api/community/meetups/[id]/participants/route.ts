import type { NextRequest } from "next/server"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"

/**
 * 참가자 명단. 관리자 전용이다 — 목록·상세 API는 명단을 절대 내려주지 않는다.
 * nickname과 joinedAt만 내보낸다. userId·email·MeetupParticipant.id는 화면에서 쓸 일이 없고,
 * 나가는 순간 오프라인 모임 참가자를 특정할 수 있는 식별자가 된다.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/community/meetups/[id]/participants">) {
  try {
    const user = await getCurrentUser()
    if (!user.isAdmin) return fail("UNAUTHORIZED", "관리자만 참가자 명단을 볼 수 있어요", 401)

    const { id } = await ctx.params

    // deletedAt으로 거르지 않는다. 무산된 모임도 관리자는 누가 신청했었는지 봐야 한다.
    const meetup = await prisma.meetup.findUnique({ where: { id }, select: { id: true } })
    if (!meetup) return fail("NOT_FOUND", "모임을 찾을 수 없어요", 404)

    const rows = await prisma.meetupParticipant.findMany({
      where: { meetupId: id, canceledAt: null },
      orderBy: { joinedAt: "asc" },
      select: { joinedAt: true, user: { select: { nickname: true } } },
    })

    const participants = rows.map((row) => ({ nickname: row.user.nickname, joinedAt: row.joinedAt }))

    // 취소한 사람. cancelReason은 선택 입력이라 null이 정상이며, 여기서도 그대로 내려간다.
    // 참가자 배열과 마찬가지로 식별자는 내보내지 않는다.
    const canceledRows = await prisma.meetupParticipant.findMany({
      where: { meetupId: id, canceledAt: { not: null } },
      orderBy: { canceledAt: "desc" },
      select: { canceledAt: true, cancelReason: true, user: { select: { nickname: true } } },
    })

    const canceled = canceledRows.map((row) => ({
      nickname: row.user.nickname,
      canceledAt: row.canceledAt,
      cancelReason: row.cancelReason,
    }))

    return ok({ participants, canceled })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
