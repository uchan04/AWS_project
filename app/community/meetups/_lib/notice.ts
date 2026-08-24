import { MeetupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type MeetupNoticeKind = "CANCELED" | "CONFIRMED"

export type MeetupNoticeItem = {
  meetupId: string
  kind: MeetupNoticeKind
  title: string
  startsAt: Date
  place: string
}

/**
 * 아직 보여주지 않은 모임 상태 변경 알림. 무산(CANCELED)과 결성(CONFIRMED) 두 종류다.
 *
 * canceledAt이 null인 행만 본다 — 본인이 스스로 신청을 취소한 건은 알릴 이유가 없고,
 * 알리면 "내가 취소한 건가, 무산된 건가"가 헷갈린다. 여기 걸리는 것은
 * 신청을 유지하고 있었는데 관리자가 모임을 무산시키거나 결성확인한 경우뿐이다.
 *
 * MeetupParticipant.notifiedCancelAt은 이름이 무산 전용처럼 보이지만
 * 실제 의미는 "이 신청 건의 상태 변경 알림을 보여준 시각"이다. 결성 알림도 같은 컬럼을 쓴다.
 * 컬럼 이름을 바꾸면 마이그레이션이 또 나가고 5인이 전부 받아야 하므로 이름은 그대로 두고
 * 의미만 여기 적어둔다. 채우는 곳은 POST /api/community/meetups/notices 하나뿐이고,
 * 한 번 채워지면 이 조회에 다시 걸리지 않으므로 배너는 신청 건당 한 번만 뜬다.
 */
export async function pendingMeetupNotices(userId: string): Promise<MeetupNoticeItem[]> {
  const rows = await prisma.meetupParticipant.findMany({
    where: {
      userId,
      canceledAt: null,
      notifiedCancelAt: null,
      meetup: { status: { in: [MeetupStatus.CANCELED, MeetupStatus.CONFIRMED] } },
    },
    orderBy: { meetup: { startsAt: "desc" } },
    select: {
      meetupId: true,
      meetup: { select: { title: true, startsAt: true, place: true, status: true } },
    },
  })

  return rows.map((row) => ({
    meetupId: row.meetupId,
    // where에서 두 상태로 좁혔지만 타입은 MeetupStatus 전체라 여기서 다시 가른다.
    kind: row.meetup.status === MeetupStatus.CONFIRMED ? "CONFIRMED" : "CANCELED",
    title: row.meetup.title,
    startsAt: row.meetup.startsAt,
    place: row.meetup.place,
  }))
}
