"use client"

import { useRouter } from "next/navigation"
import { MeetupCard, type MeetupListItem } from "./MeetupCard"
import { MeetupCreateModal } from "./MeetupCreateModal"

/**
 * page.tsx는 서버 컴포넌트라 router.refresh()를 못 부른다. 신청·취소·결성확인·무산 뒤에
 * 목록을 다시 읽으려면 클라이언트 경계가 하나 필요해서 PostList와 같은 자리에 이 파일을 뒀다.
 */
export function MeetupList({ meetups, isAdmin }: { meetups: MeetupListItem[]; isAdmin: boolean }) {
  const router = useRouter()

  return (
    <>
      {/* 일반 유저에게는 개설 버튼도 모달도 렌더 트리에 넣지 않는다. 서버도 isAdmin을 다시 확인한다. */}
      {isAdmin && (
        <div className="flex justify-end">
          <MeetupCreateModal onCreated={() => router.refresh()} />
        </div>
      )}

      {meetups.length === 0 ? (
        <p className="py-24 text-center text-sm leading-relaxed text-neutral-500">
          아직 열린 모임이 없어요.
          <br />
          모임이 열리면 여기에서 안내할게요.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {meetups.map((meetup, index) => (
            <MeetupCard
              key={meetup.id}
              meetup={meetup}
              isAdmin={isAdmin}
              // 진입 전환의 순차 지연에만 쓴다. 카드 내용은 index에 의존하지 않는다.
              index={index}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </>
  )
}
