import Link from "next/link"
import { notFound } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { TRIBE, authorLabel } from "@/lib/types"
import { GalleryTabs } from "../_components/GalleryTabs"
import { formatPostDate } from "../_lib/format"

const POST_LIST_LIMIT = 20

function isTypeCode(value: string): value is TypeCode {
  return value in TRIBE
}

export default async function GalleryPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!isTypeCode(type)) notFound()

  const tribe = TRIBE[type]
  const posts = await prisma.post.findMany({
    where: { galleryType: type, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: POST_LIST_LIMIT,
    include: { user: { select: { nickname: true, typeCode: true } } },
  })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <GalleryTabs active={type} />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: tribe.colorHex }}>
          {tribe.animal} 갤러리
        </h1>
        <Link
          href={`/community/${type}/new`}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
          style={{ backgroundColor: tribe.colorHex }}
        >
          글쓰기
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-500">
          아직 글이 없어요. 첫 글을 남겨보세요.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/community/${type}/${post.id}`}
                className="flex flex-col gap-1 py-3 hover:bg-neutral-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{post.title}</span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {formatPostDate(post.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {post.user.typeCode
                      ? authorLabel(post.user.nickname, post.user.typeCode)
                      : post.user.nickname}
                  </span>
                  <span>
                    좋아요 {post.likeCount} · 댓글 {post.commentCount}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
