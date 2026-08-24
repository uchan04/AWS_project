import { MeetupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type CancelNoticeItem = {
  meetupId: string
  title: string
  startsAt: Date
  place: string
}

/**
 * 아직 보여주지 않은 "모임 무산" 알림.
 *
 * canceledAt이 null인 행만 본다 — 본인이 스스로 신청을 취소한 건은 알릴 이유가 없고,
 * 알리면 "내가 취소한 건가, 무산된 건가"가 헷갈린다. 여기 걸리는 것은
 * 신청을 유지하고 있었는데 관리자가 모임을 무산시킨 경우뿐이다.
 *
 * notifiedCancelAt은 POST /api/community/meetups/notices가 채운다. 한 번 채워지면
 * 이 조회에 다시 걸리지 않으므로 배너는 유저당 한 번만 뜬다.
 */
export async function pendingCancelNotices(userId: string): Promise<CancelNoticeItem[]> {
  const rows = await prisma.meetupParticipant.findMany({
    where: {
      userId,
      canceledAt: null,
      notifiedCancelAt: null,
      meetup: { status: MeetupStatus.CANCELED },
    },
    orderBy: { meetup: { startsAt: "desc" } },
    select: {
      meetupId: true,
      meetup: { select: { title: true, startsAt: true, place: true } },
    },
  })

  return rows.map((row) => ({
    meetupId: row.meetupId,
    title: row.meetup.title,
    startsAt: row.meetup.startsAt,
    place: row.meetup.place,
  }))
}
