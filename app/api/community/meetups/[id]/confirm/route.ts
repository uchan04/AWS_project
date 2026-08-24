import type { NextRequest } from "next/server"
import { MeetupStatus } from "@prisma/client"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"

/**
 * 결성확인. 관리자만 한다.
 * 참가자 친밀도는 지급하지 않는다 — 관리자 행동이라 참가자가 그 시점에 접속해 있지 않고,
 * 일괄 지급은 배치가 필요해 이번 범위에서 뺐다.
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/community/meetups/[id]/confirm">) {
  try {
    const user = await getCurrentUser()
    if (!user.isAdmin) return fail("UNAUTHORIZED", "관리자만 모임을 결성확인할 수 있어요", 401)

    const { id } = await ctx.params

    const meetup = await prisma.meetup.findUnique({
      where: { id },
      select: { deletedAt: true, status: true, joinCount: true, minCount: true },
    })
    if (!meetup) return fail("NOT_FOUND", "모임을 찾을 수 없어요", 404)
    if (meetup.deletedAt) return fail("NOT_FOUND", "이미 무산된 모임이에요", 404)

    if (meetup.status !== MeetupStatus.OPEN) return fail("INVALID_STATE", "이미 처리된 모임입니다", 400)

    if (meetup.joinCount < meetup.minCount) {
      return fail("NOT_ENOUGH_PARTICIPANTS", "최소 인원이 모이지 않았습니다", 400)
    }

    const updated = await prisma.meetup.update({
      where: { id },
      data: { status: MeetupStatus.CONFIRMED, confirmedAt: new Date() },
      select: { id: true, status: true, confirmedAt: true, joinCount: true },
    })

    return ok({ meetup: updated })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
