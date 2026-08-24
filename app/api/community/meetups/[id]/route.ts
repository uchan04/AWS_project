import type { NextRequest } from "next/server"
import { MeetupStatus } from "@prisma/client"
import { getCurrentUser, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"

// 무산도 관리자만 한다. 소프트 삭제라 신청 이력(MeetupParticipant)은 그대로 남는다.
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/community/meetups/[id]">) {
  try {
    const user = await getCurrentUser()
    if (!user.isAdmin) return fail("UNAUTHORIZED", "관리자만 모임을 무산시킬 수 있어요", 401)

    const { id } = await ctx.params

    const meetup = await prisma.meetup.findUnique({ where: { id }, select: { deletedAt: true } })
    if (!meetup) return fail("NOT_FOUND", "모임을 찾을 수 없어요", 404)
    if (meetup.deletedAt) return fail("NOT_FOUND", "이미 무산된 모임이에요", 404)

    // status와 deletedAt을 한 번에 세팅한다. 목록은 deletedAt으로 거르고,
    // 이미 신청한 사람의 화면은 status로 "무산됨"을 표시한다.
    await prisma.meetup.update({
      where: { id },
      data: { status: MeetupStatus.CANCELED, deletedAt: new Date() },
    })

    return ok({ id })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
