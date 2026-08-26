import { MeetupStatus } from "@prisma/client"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MeetupList } from "./_components/MeetupList"
import { MeetupNotice } from "./_components/MeetupNotice"
import type { MeetupListItem } from "./_components/MeetupCard"
import { pendingMeetupNotices, type MeetupNoticeItem } from "./_lib/notice"
import { myJoinedMeetups } from "./_lib/joined"

// 유저별 데이터(joined·isAdmin)를 읽으므로 정적 프리렌더 대상이 아니다. community/page.tsx와 같은 이유다.
export const dynamic = "force-dynamic"

export default async function MeetupsPage() {
  let isAdmin: boolean
  let meetups: MeetupListItem[]
  let joined: MeetupListItem[]
  let nowMs: number
  let notices: MeetupNoticeItem[]

  // 인증이나 DB가 실패해도 화면을 죽이지 않고 안내를 띄운다(community/page.tsx와 같은 패턴).
  try {
    const user = await getCurrentUser()

    // 진단 전이면 커뮤니티로 보낸다 (2026-08-26, 차단 32번). app/community/page.tsx가
    // 같은 기준을 쓴다. **라우트 쪽 가드가 본체다** — 페이지만 막으면 API는 열려 있다
    // (join/route.ts 주석). 이쪽은 화면이 반쪽으로 그려지는 것을 막는 몫이다
    if (!user.typeCode || !user.adjective) redirect("/community")
    isAdmin = user.isAdmin

    // "지금"을 한 번만 찍어 조회와 화면이 같은 기준을 쓰게 한다.
    const now = new Date()
    nowMs = now.getTime()

    joined = await myJoinedMeetups(user.id)

    // 조회 조건은 GET /api/community/meetups의 OPEN 기본 동작과 같다.
    // 목록을 API로 다시 받아오지 않고 여기서 직접 읽는다(posts와 같은 방식).
    // 이미 신청한 모임은 위 구역에 있으므로 뺀다 — 같은 카드가 두 번 나오면 어느 쪽을 눌러야 할지 헷갈린다.
    const rows = await prisma.meetup.findMany({
      where: {
        deletedAt: null,
        status: MeetupStatus.OPEN,
        startsAt: { gte: now },
        ...(joined.length > 0 ? { id: { notIn: joined.map((meetup) => meetup.id) } } : {}),
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        galleryType: true,
        title: true,
        place: true,
        startsAt: true,
        minCount: true,
        capacity: true,
        joinCount: true,
        status: true,
        host: { select: { nickname: true } },
        // 본인 행만 골라 온다. 명단 전체를 include하면 화면 props에 남의 신청 정보가 실린다.
        participants: { where: { userId: user.id, canceledAt: null }, select: { id: true } },
      },
    })

    meetups = rows.map(({ participants, ...meetup }) => ({ ...meetup, joined: participants.length > 0 }))

    // 무산된 모임은 위 목록(status OPEN)에 없다. 신청해 뒀던 사람에게는 배너로만 알린다.
    notices = await pendingMeetupNotices(user.id)
  } catch (error) {
    console.error("[/community/meetups]", error)
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <h1 className="text-xl font-bold text-neutral-900">오프라인 모임</h1>
        <div className="rounded-2xl bg-white p-8 text-center">
          <p className="text-sm text-neutral-700">로그인이 필요해요</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            진단을 아직 안 했다면 진단을 먼저 완료해 주세요.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <MeetupNotice notices={notices} />

      <div>
        <h1 className="text-xl font-bold text-neutral-900">오프라인 모임</h1>
        <p className="mt-1 text-sm text-neutral-500">천천히, 준비됐을 때 나가면 돼요</p>
      </div>

      {/* 비어 있으면 구역 자체를 렌더하지 않는다. 아직 아무것도 안 한 사람에게 빈 상자를 보여줄 이유가 없다. */}
      {joined.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-neutral-900">내가 신청한 모임</h2>
          <MeetupList meetups={joined} isAdmin={isAdmin} nowMs={nowMs} showCreateButton={false} />
        </section>
      )}

      <MeetupList meetups={meetups} isAdmin={isAdmin} nowMs={nowMs} />
    </main>
  )
}
