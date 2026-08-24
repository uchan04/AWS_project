import { MeetupStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { MeetupListItem } from "../_components/MeetupCard"

/**
 * 내가 신청해 둔 모임. "내가 신청한 모임" 구역이 쓴다.
 *
 * CANCELED는 뺀다 — 무산은 MeetupNotice 배너가 따로 다루고, 여기에도 두면 같은 소식을 두 번 말한다.
 * 지난 모임은 뺀 것이 아니라 뒤로 민다. 목록의 미래 필터(startsAt >= now)를 여기 적용하면
 * 방금 끝난 모임이 화면에서 사라져 "내가 뭘 신청했었지"를 확인할 데가 없어진다.
 *
 * 반환 형태는 MeetupCard가 그대로 받을 수 있게 MeetupListItem에 맞춘다 —
 * 지시된 필드(id·title·place·startsAt·status·joinCount·capacity·minCount)에
 * 카드가 요구하는 galleryType·host·joined를 더한 것이다. joined는 조회 조건상 항상 true다.
 */
export async function myJoinedMeetups(userId: string): Promise<MeetupListItem[]> {
  const rows = await prisma.meetupParticipant.findMany({
    where: {
      userId,
      canceledAt: null,
      meetup: {
        deletedAt: null,
        status: { in: [MeetupStatus.OPEN, MeetupStatus.CONFIRMED] },
      },
    },
    select: {
      meetup: {
        select: {
          id: true,
          galleryType: true,
          title: true,
          place: true,
          startsAt: true,
          status: true,
          joinCount: true,
          capacity: true,
          minCount: true,
          host: { select: { nickname: true } },
        },
      },
    },
  })

  const items: MeetupListItem[] = rows.map((row) => ({ ...row.meetup, joined: true }))

  // startsAt 오름차순. 단 이미 지난 모임은 통째로 뒤로 민다(그 안에서도 오름차순).
  // DB의 orderBy 하나로는 "지난 것만 뒤로"를 표현할 수 없어 여기서 정렬한다.
  const now = Date.now()
  return items.sort((a, b) => {
    const aPast = a.startsAt.getTime() < now
    const bPast = b.startsAt.getTime() < now
    if (aPast !== bPast) return aPast ? 1 : -1
    return a.startsAt.getTime() - b.startsAt.getTime()
  })
}
