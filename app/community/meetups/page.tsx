import { MeetupStatus } from "@prisma/client"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MeetupList } from "./_components/MeetupList"
import { MeetupNotice } from "./_components/MeetupNotice"
import { MyJoinsModal } from "./_components/MyJoinsModal"
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

    // **셋을 함께 묶는다(2026-08-27).** 예전에는 아래 `meetup.findMany`가 `joined`의 id를
    // `notIn`으로 써서 순서를 지켜야 했는데, "내가 신청한 모임" 구역을 모달로 옮기면서
    // 그 제외 조건을 뺐다(아래 주석). 이제 셋 사이에 의존이 없다.
    //
    // **allSettled가 아니라 all이다.** 여기는 검열이 아니라 화면 조회다 — 한쪽이 실패하면
    // 화면을 그릴 수 없고, 바깥 try/catch가 안내 화면으로 받는 기존 동작이 맞다(위 주석).
    //
    // 무산된 모임은 아래 목록(status OPEN)에 없다. 신청해 뒀던 사람에게는 배너로만 알린다.
    //
    // `Promise.all`이 왕복 1회를 **보장하지는 않는다** — Postgres의 prepare 캐시가 연결마다
    // 따로라 병렬 묶음의 벽시계가 왕복 1~4회를 오간다(`docs/dev/perf.md` "고친 것 4번째").
    // 그래도 순차로 부르는 것보다 나쁠 수는 없다.
    //
    // 조회 조건은 GET /api/community/meetups의 OPEN 기본 동작과 같다.
    // 목록을 API로 다시 받아오지 않고 여기서 직접 읽는다(posts와 같은 방식).
    //
    // **신청한 모임을 목록에서 빼지 않는다.** 예전에는 위쪽 "내가 신청한 모임" 구역과
    // 겹치지 않게 `notIn`으로 뺐지만, 그 구역이 모달로 빠진 지금 목록은 전체 모임 하나뿐이다.
    // 신청해 둔 모임은 카드가 알아서 "신청 취소"를 그린다(MeetupCard의 `joined`).
    const [joinedRows, pendingNotices, rows] = await Promise.all([
      myJoinedMeetups(user.id),
      pendingMeetupNotices(user.id),
      prisma.meetup.findMany({
        where: {
          deletedAt: null,
          status: MeetupStatus.OPEN,
          startsAt: { gte: now },
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
      }),
    ])

    joined = joinedRows
    notices = pendingNotices
    meetups = rows.map(({ participants, ...meetup }) => ({ ...meetup, joined: participants.length > 0 }))
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

      {/* 제목 줄의 배치는 커뮤니티 첫 화면과 같다 — 왼쪽에 제목, 오른쪽에 보조 동작 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">오프라인 모임</h1>
          <p className="mt-1 text-sm text-neutral-500">천천히, 준비됐을 때 나가면 돼요</p>
        </div>

        {/* 신청한 것이 없어도 버튼은 늘 둔다. 빈 상태 문구는 모달 안에 있다 —
            버튼이 나타났다 사라지면 "어제 있던 게 없어졌다"로 읽힌다 */}
        <MyJoinsModal joined={joined} nowMs={nowMs} />
      </div>

      <MeetupList meetups={meetups} isAdmin={isAdmin} nowMs={nowMs} />
    </main>
  )
}
