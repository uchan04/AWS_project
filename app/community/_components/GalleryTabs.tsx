import Link from "next/link"
import { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import type { GalleryTab } from "../_lib/gallery"

/**
 * 갤러리 탭.
 *
 * 일반 유저는 2개다 — 전체 커뮤니티 / 나의 종족. 종족 갤러리는 진단을 마친 유저에게만 노출한다.
 *
 * **관리자는 종족 3종을 모두 본다(2026-08-26).** 읽기뿐 아니라 글·댓글·좋아요도 된다
 * (`_lib/gallery.ts`의 `canAccessGallery()`).
 *
 * 탭 이름은 종족 이름 그대로다(고양잇과·개과·곰과 갤러리). **"나의 종족" 알약은 뗐다
 * (2026-08-26).** 비관리자에게는 자기 종족 탭 하나뿐이라 알약이 더 알려주는 것이 없었고,
 * 관리자에게는 세 탭이 전부 남의 종족이라 애초에 붙지 않았다.
 *
 * 관리자 상태는 **탭 줄 끝에 한 번만** 알린다. 표시가 없으면 시연 중에 누구나 쓸 수
 * 있는 기능으로 오해된다.
 */
export function GalleryTabs({
  active,
  myTypeCode,
  isAdmin,
}: {
  active: GalleryTab
  myTypeCode: TypeCode | null
  isAdmin: boolean
}) {
  const isAll = active === "ALL"

  // 선택되지 않은 탭에만 붙인다. 이미 선택된 탭이 눌리는 것처럼 보이면 안 된다.
  // 종족 탭은 배경이 인라인 종족 색이라 hover:bg-*를 못 쓴다 — 두 탭의 반응을 그림자·이동으로 맞춘다.
  const INACTIVE_HOVER = "hover:shadow-md motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
  const FOCUS_RING =
    "focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none"

  /*
   * 관리자면 종족 3종 전부, 아니면 내 종족 하나만. 진단 전(myTypeCode === null)인 일반
   * 유저에게는 종족 탭이 없다 — 지금 동작 그대로다.
   *
   * 내 종족 탭의 링크는 `?tab=mine`을 유지한다. 종족 코드로 바꿔도 결과는 같지만,
   * 그 주소가 이미 화면·북마크에 돌아다닌다.
   */
  const tribeTabs: TypeCode[] = isAdmin
    ? (Object.values(TypeCode) as TypeCode[])
    : myTypeCode
      ? [myTypeCode]
      : []

  return (
    <nav className="flex flex-wrap gap-2">
      <Link
        href="/community"
        className={
          "rounded-xl border px-5 py-2.5 text-sm font-semibold transition duration-150 " +
          FOCUS_RING +
          " " +
          (isAll
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 " + INACTIVE_HOVER)
        }
      >
        전체 커뮤니티
      </Link>

      {tribeTabs.map((tribe) => {
        const selected = active === tribe
        const mine = tribe === myTypeCode

        return (
          <Link
            key={tribe}
            href={mine ? "/community?tab=mine" : `/community?tab=${tribe}`}
            className={
              "rounded-xl border px-5 py-2.5 text-sm font-semibold transition duration-150 " +
              FOCUS_RING +
              (selected ? "" : " " + INACTIVE_HOVER)
            }
            style={
              selected
                ? { borderColor: TRIBE[tribe].colorHex, backgroundColor: TRIBE[tribe].colorHex, color: "#fff" }
                : { borderColor: TRIBE[tribe].colorHex, color: TRIBE[tribe].colorHex, backgroundColor: "#fff" }
            }
          >
            {TRIBE[tribe].animal} 갤러리
          </Link>
        )
      })}

      {/* 관리자 표시는 여기 한 곳뿐이다. 링크가 아니라 설명이라 탭으로 오해되지 않게
          테두리·배경 없이 둔다 */}
      {isAdmin && (
        <span className="self-center text-xs text-neutral-400">관리자라서 모든 종족 갤러리가 보여요</span>
      )}
    </nav>
  )
}
