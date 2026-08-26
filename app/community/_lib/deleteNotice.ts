import { prisma } from "@/lib/prisma"

export type DeletedNoticeKind = "POST" | "COMMENT"

/**
 * 관리자에게 삭제된 글·댓글 한 건.
 *
 * **본문을 담지 않는다.** 지워진 내용을 다시 보여줄 이유가 없고, 팝업에 그대로 띄우면
 * 작성자에게 두 번 보이는 셈이 된다. 글은 제목, 댓글은 달았던 글의 제목만 준다 —
 * "무엇이 지워졌는지" 알아볼 수 있으면 충분하다.
 *
 * 어떤 표현이 문제였는지도 담지 않는다(우회 학습 방지). `_lib/moderation.ts`의
 * `hits`를 사용자에게 노출하지 않는 것과 같은 이유다.
 */
export type DeletedNoticeItem = {
  kind: DeletedNoticeKind
  id: string
  /** 글이면 그 글의 제목, 댓글이면 그 댓글이 달렸던 글의 제목 */
  title: string
}

/**
 * 아직 통보하지 않은 관리자 삭제 건의 조회 조건.
 *
 * **조회와 읽음 처리가 이 함수 하나를 함께 쓴다.** 조건이 두 벌이 되면 한쪽만 고쳐졌을 때
 * *보여주지 않은 알림이 읽음으로 찍힌다* — `app/api/community/meetups/notices/route.ts`
 * 주석이 같은 함정을 지적하고 있고, 그쪽은 조건을 손으로 두 번 적어 두었다.
 *
 * `userId`를 조건에 박는 것이 소유권 강제다. 남의 postId·commentId를 섞어 보내도
 * 그 사람의 알림은 건드려지지 않는다.
 *
 * Post와 Comment가 같은 세 컬럼(`userId`·`deletedByAdmin`·`deleteNotifiedAt`)을 갖고 있어
 * 조건이 같은 모양이다(prisma/schema.prisma의 Comment 쪽 주석: "Post와 같은 이유·같은 구조다").
 */
export function pendingDeleteWhere(userId: string) {
  return { userId, deletedByAdmin: true, deleteNotifiedAt: null }
}

/**
 * 다음 접속 때 띄울 관리자 삭제 통보. 글과 댓글 양쪽을 본다.
 *
 * 본인이 지운 것은 여기 걸리지 않는다 — 두 DELETE 라우트가 `deletedByAdmin`을
 * "남이 지웠는지"로만 찍기 때문이다(관리자가 자기 글을 지우면 false).
 *
 * 한 번 `deleteNotifiedAt`이 찍히면 이 조회에 다시 걸리지 않으므로 건당 한 번만 뜬다.
 * 채우는 곳은 `POST /api/community/notices/deleted` 하나뿐이다.
 */
export async function pendingDeleteNotices(userId: string): Promise<DeletedNoticeItem[]> {
  const where = pendingDeleteWhere(userId)

  const [posts, comments] = await Promise.all([
    prisma.post.findMany({
      where,
      select: { id: true, title: true, deletedAt: true },
    }),
    prisma.comment.findMany({
      where,
      // 댓글 자체의 내용이 아니라 "어느 글에 달았던 것인지"만 가져온다.
      select: { id: true, deletedAt: true, post: { select: { title: true } } },
    }),
  ])

  // 두 목록을 합쳐 최근 삭제가 위로 오게 한다. deletedAt은 정렬에만 쓰고 돌려주지 않는다 —
  // 팝업 문구가 시각을 쓰지 않으므로 내보낼 이유가 없다.
  return [
    ...posts.map((post) => ({ kind: "POST" as const, id: post.id, title: post.title, at: post.deletedAt })),
    ...comments.map((comment) => ({
      kind: "COMMENT" as const,
      id: comment.id,
      title: comment.post.title,
      at: comment.deletedAt,
    })),
  ]
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .map(({ kind, id, title }) => ({ kind, id, title }))
}
