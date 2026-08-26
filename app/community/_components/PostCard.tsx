import type { GalleryPost } from "../_lib/gallery"
import { ADMIN_LABEL, communityAuthorBadge } from "../_lib/author"
import { timeAgo } from "../_lib/format"

/**
 * 목록 카드. **모든 카드가 같은 골격을 갖는다(2026-08-26)** — 제목 / 메타 / 본문·썸네일 / 액션 4단.
 *
 * 예전에는 작성자 줄이 맨 위였고 제목이 `font-medium` 기본 크기라, 이름이 제목보다 먼저
 * 읽혔다. 그리고 썸네일이 **본문 아래에 더해지는** 구조라 사진 있는 글만 카드가 약 186px
 * 길어져 같은 행 전체가 그 높이로 끌려갔다.
 *
 * 그래서 둘을 바꿨다.
 *   - 제목을 맨 위로 올리고 text-lg/bold로 세운다. 작성자는 시각과 합쳐 흐린 메타 한 줄로 내린다
 *   - 본문과 썸네일은 **배타**다. 사진이 있으면 사진만, 없으면 본문만 보여준다.
 *     둘 다 보고 싶으면 카드를 눌러 상세로 간다
 *
 * 높이 정렬은 세 가지가 함께 만든다 — 그리드의 items-stretch(초기값이지만 PostList에
 * 명시), 카드의 h-full(button은 stretch만으로 늘어난 칸을 채우지 않는다), 액션줄의 mt-auto.
 * 하나라도 빠지면 짧은 카드의 좋아요·댓글 줄이 중간에 뜬다.
 *
 * **가로 넘침 방지는 min-w-0 + break-words 두 개가 함께 있어야 한다(2026-08-26).**
 * line-clamp는 세로 줄 수만 제어해서, 공백 없는 긴 문자열("ffffff…")이 카드 밖으로 흘렀다.
 * break-words만 붙이면 반쪽이다 — 그리드 아이템의 min-width는 기본 auto라 min-content
 * 아래로 줄지 않고, 긴 단어가 1fr 컬럼 자체를 밀어 격자가 깨진다. 그래서 카드에 min-w-0을
 * 함께 준다(_components/DeletedNoticeDialog.tsx가 쓰는 짝과 같다).
 */
export function PostCard({
  post,
  showTribeBadge,
  onClick,
}: {
  post: GalleryPost
  showTribeBadge: boolean
  onClick: () => void
}) {
  // 우측 배지. 관리자면 종족 대신 "관리자"다(_lib/author.ts)
  const badge = communityAuthorBadge(post.user)

  /*
   * 메타 줄의 작성자 표기. **닉네임만 쓴다(2026-08-26).**
   *
   * `communityAuthorLabel()`은 "느긋한 곰 · 곰과"를 준다. 그런데 같은 줄 오른쪽 끝에 이미
   * 종족 배지가 있어서 한 줄에 종족이 두 번 나왔다.
   *
   * **`_lib/author.ts`의 그 함수를 고치지 않는다.** 공용이고, 종족 표기가 그대로여야 하는
   * 화면이 따로 있다. 그래서 여기서만 다르게 조립한다(PostDetailModal이 같은 방식이다).
   *
   * 관리자 표기는 남긴다 — 종족이 아니라 역할이고, 배지가 없는 종족 갤러리에서도
   * 남의 글을 지울 수 있는 사람이 누구인지는 드러나야 한다. 문구는 하드코딩하지 않고
   * 그 파일이 export하는 ADMIN_LABEL을 쓴다.
   *
   * 배지가 없는 화면(종족 갤러리, showTribeBadge=false)에서 종족이 아예 사라지지만
   * 잃는 정보는 없다 — 그 목록은 galleryType으로 걸러온 글이고 비관리자는 자기 종족
   * 갤러리에만 쓸 수 있어(posts 라우트의 canAccessGallery) 작성자 종족이 곧 그 갤러리다.
   * 관리자 글은 원래도 저 함수가 종족 대신 "관리자"를 주어 종족이 보이지 않았다.
   */
  const authorText = post.user.isAdmin ? `${post.user.nickname} · ${ADMIN_LABEL}` : post.user.nickname

  return (
    <button
      type="button"
      onClick={onClick}
      // 카드가 여러 개 나열되므로 scale은 쓰지 않는다(격자가 흔들린다). 그림자 한 단계 + 2px 부양만.
      className="flex h-full w-full min-w-0 flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 text-left transition duration-150 hover:border-neutral-300 hover:shadow-md focus-visible:border-neutral-300 focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
    >
      {/* 1단 제목. 카드에서 가장 강한 요소다. 2줄까지 허용하고 그 뒤는 자른다 —
          1줄로 자르면 긴 제목이 대부분 잘리고, 풀어두면 카드 높이가 제목 길이를 탄다 */}
      <p className="line-clamp-2 text-lg leading-snug font-bold break-words text-neutral-900">{post.title}</p>

      {/* 2단 메타. 작성자와 시각을 한 줄로 합쳤다 — 제목을 세우려면 나머지가 물러나야 한다.
          이름이 길 때 줄어드는 것은 이름뿐이다(truncate). 시각과 배지는 shrink-0으로 지킨다.
          **종족은 여기 쓰지 않는다** — 같은 줄 오른쪽 배지가 이미 말한다(아래 authorText 주석) */}
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <span className="min-w-0 truncate">{authorText}</span>
        <span className="shrink-0">· {timeAgo(post.createdAt)}</span>

        {showTribeBadge && badge && (
          <span
            className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: `${badge.colorHex}22`, color: badge.colorHex }}
          >
            {badge.text}
          </span>
        )}
      </div>

      {/* 3단 본문 또는 썸네일. **둘 중 하나만 나온다.**
          썸네일: 사진 비율이 제각각이라 16:9로 잘라 고정한다 — 원본 비율로 두면 세로로 긴 사진
          하나가 격자 한 칸을 몇 배로 늘려 옆 카드와 높이가 어긋난다. 원본 비율은 상세에서 본다.
          next/image를 쓰지 않는 이유는 미션 화면과 같다 — 설정에 없는 hostname이면 렌더 중에 throw한다.
          본문: whitespace-pre-line으로 작성자가 나눈 문단을 살리되, line-clamp-4로 길이를 묶는다.
          클램프가 없으면 긴 글 하나가 행 전체를 늘린다 */}
      {post.imageUrl ? (
        <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <p className="line-clamp-4 text-sm leading-relaxed break-words whitespace-pre-line text-neutral-600">{post.body}</p>
      )}

      {/* 4단 액션. mt-auto로 카드 바닥에 붙인다 — 내용이 짧아도 같은 행의 다른 카드와 줄이 맞는다 */}
      <div className="mt-auto flex gap-4 text-xs text-neutral-400">
        <span>좋아요 {post.likeCount}</span>
        <span>댓글 {post.commentCount}</span>
      </div>
    </button>
  )
}
