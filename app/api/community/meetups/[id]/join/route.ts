import type { NextRequest } from "next/server"
import { Prisma, MeetupStatus } from "@prisma/client"
import { getCurrentUser, getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { grantAffinity, MEETUP_JOIN_AFFINITY } from "@/app/community/_lib/affinity"

/**
 * 트랜잭션 안에서 판정한 실패를 밖으로 내보내는 통로.
 * throw해야 트랜잭션이 롤백되므로 return fail()을 쓸 수 없다. code·message를 실어 보내고
 * catch에서 fail()로 바꾼다.
 */
class MeetupJoinError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

// 신청. 신규 신청에만 친밀도를 지급하므로 getCurrentUserWithSkin()을 쓴다
// (grantAffinity가 calculateReward에 넘길 activePetSkin을 요구한다).
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/community/meetups/[id]/join">) {
  try {
    const user = await getCurrentUserWithSkin()
    const { id } = await ctx.params

    const meetup = await prisma.meetup.findUnique({
      where: { id },
      select: { deletedAt: true, status: true, startsAt: true },
    })
    if (!meetup) return fail("NOT_FOUND", "모임을 찾을 수 없어요", 404)
    if (meetup.deletedAt) return fail("NOT_FOUND", "이미 무산된 모임이에요", 404)

    if (meetup.status !== MeetupStatus.OPEN) return fail("INVALID_STATE", "신청이 마감된 모임입니다", 400)

    // 관리자가 결성확인도 무산도 하지 않은 모임은 시작일이 지나도 OPEN으로 머물러 있다.
    // 그 상태 검사만으로는 못 막으므로 시각을 따로 본다.
    if (meetup.startsAt.getTime() < Date.now()) {
      return fail("MEETUP_PASSED", "이미 지난 모임입니다", 400)
    }

    let result: { joinCount: number; isNewJoin: boolean }
    try {
      result = await prisma.$transaction(async (tx) => {
        const existing = await tx.meetupParticipant.findUnique({
          where: { meetupId_userId: { meetupId: id, userId: user.id } },
          select: { id: true, canceledAt: true },
        })

        let isNewJoin = false
        if (existing) {
          if (!existing.canceledAt) throw new MeetupJoinError("ALREADY_JOINED", "이미 신청한 모임입니다")
          // 재신청. 행을 새로 만들지 않고 canceledAt만 되돌린다 — 친밀도는 주지 않는다.
          await tx.meetupParticipant.update({ where: { id: existing.id }, data: { canceledAt: null } })
        } else {
          await tx.meetupParticipant.create({ data: { meetupId: id, userId: user.id } })
          isNewJoin = true
        }

        const updated = await tx.meetup.update({
          where: { id },
          data: { joinCount: { increment: 1 } },
          select: { joinCount: true, capacity: true },
        })

        // 정원 검사는 증가시킨 뒤에 한다. 먼저 읽고 비교하면 동시 신청 두 건이 같은 값을 읽어
        // 둘 다 통과한다. 넘겼으면 throw해서 신청 행과 joinCount를 함께 롤백한다.
        if (updated.joinCount > updated.capacity) {
          throw new MeetupJoinError("MEETUP_FULL", "정원이 찼습니다")
        }

        return { joinCount: updated.joinCount, isNewJoin }
      })
    } catch (error) {
      if (error instanceof MeetupJoinError) return fail(error.code, error.message, 400)
      // @@unique([meetupId, userId]) — findUnique와 create 사이에 다른 요청이 먼저 만든 경우.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return fail("ALREADY_JOINED", "이미 신청한 모임입니다", 400)
      }
      throw error
    }

    // 친밀도는 트랜잭션 밖에서, 신규 신청일 때만 준다.
    // 재신청에도 주면 신청·취소를 반복해 무한히 받을 수 있다(prisma/schema.prisma의 MeetupParticipant 주석).
    // 별도 try/catch에 넣어 지급이 실패해도 신청이 롤백되지 않게 한다.
    let granted = 0
    if (result.isNewJoin) {
      try {
        granted = await grantAffinity(user, MEETUP_JOIN_AFFINITY)
      } catch (error) {
        console.error("[MEETUP_JOIN] 친밀도 지급 실패", error)
      }
    }

    return ok({ joined: true, joinCount: result.joinCount, granted })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}

// 취소 사유의 상한. 화면(MeetupCard)의 입력 제한과 같은 값이다.
const REASON_MAX = 200

// 신청 취소. 친밀도는 회수하지 않는다.
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/community/meetups/[id]/join">) {
  try {
    const user = await getCurrentUser()
    const { id } = await ctx.params

    // 사유는 선택이다. body 없이 오는 DELETE도 정상이므로 파싱 실패를 그대로 흘려보낸다.
    // 필수로 만들면 취소를 회피하고 말없이 안 나타나는 쪽으로 흐른다.
    const payload = await request.json().catch(() => null)
    const rawReason = typeof payload?.reason === "string" ? payload.reason.trim() : ""
    if (rawReason.length > REASON_MAX) return fail("INVALID_BODY", "취소 사유가 너무 길어요", 400)
    // 빈 문자열이면 컬럼을 건드리지 않는다. null이 정상 상태다.
    const cancelReason = rawReason || null

    const meetup = await prisma.meetup.findUnique({ where: { id }, select: { deletedAt: true, status: true } })
    if (!meetup) return fail("NOT_FOUND", "모임을 찾을 수 없어요", 404)
    if (meetup.deletedAt) return fail("NOT_FOUND", "이미 무산된 모임이에요", 404)

    if (meetup.status !== MeetupStatus.OPEN) {
      return fail("INVALID_STATE", "확정된 모임은 취소할 수 없습니다", 400)
    }

    let joinCount: number
    try {
      joinCount = await prisma.$transaction(async (tx) => {
        // updateMany의 count로 판정한다. 먼저 읽고 검사하면 동시 취소 두 건이 모두 통과해
        // joinCount가 두 번 깎인다. canceledAt이 null인 행만 갱신하므로 두 번째는 count 0이다.
        // cancelReason을 같은 update에 얹는다. 따로 부르면 취소는 됐는데 사유만 빠지는 상태가 생긴다.
        const canceled = await tx.meetupParticipant.updateMany({
          where: { meetupId: id, userId: user.id, canceledAt: null },
          data: { canceledAt: new Date(), ...(cancelReason ? { cancelReason } : {}) },
        })
        if (canceled.count === 0) throw new MeetupJoinError("NOT_JOINED", "신청하지 않은 모임입니다")

        // joinCount > 0 조건을 where에 둬서 0 미만으로 내려가지 않게 한다.
        await tx.meetup.updateMany({
          where: { id, joinCount: { gt: 0 } },
          data: { joinCount: { decrement: 1 } },
        })

        const updated = await tx.meetup.findUniqueOrThrow({ where: { id }, select: { joinCount: true } })
        return updated.joinCount
      })
    } catch (error) {
      if (error instanceof MeetupJoinError) return fail(error.code, error.message, 400)
      throw error
    }

    return ok({ joined: false, joinCount })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
