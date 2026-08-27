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
 *
 * ── 트랙 세그먼트 (2026-08-27) ───────────────────────────────────────────────
 *
 * 알약 → 밑줄 → 트랙 순으로 왔다. 각 단계에서 버린 것이 다르다.
 *
 * **알약을 버린 이유: 탭은 동작이 아니라 구획이다.** 테두리 있는 알약이 hover에서
 * 그림자와 함께 떠오르면 버튼의 어휘가 된다. 같은 화면에 진짜 버튼("글 쓰기")이
 * 있는데 탭이 더 크게 반응하면 무엇을 눌러야 할지가 흐려진다.
 *
 * **밑줄 대신 트랙을 쓰는 이유:** 트랙(회색 띠) 안에 들어 있으면 채워진 탭이라도
 * 알약처럼 떠 보이지 않는다. 띠가 "여기까지가 한 묶음"이라고 먼저 말하고, 그 안에서
 * 흰 칸 하나가 "지금 여기"를 가리킨다. 눌리는 것이 아니라 골라진 것으로 읽힌다.
 *
 * **활성 종족 탭만 종족색 원색 칩이 된다(2026-08-27).** 잠시 "종족색을 탭에 쓰지
 * 않는다"로 뒀다가 되돌렸다 — 아래 HopeBanner도 종족색이지만 **무게가 다르다.**
 * 배너는 22% 알파를 깐 넓은 띠(면)이고 탭은 원색을 채운 작은 칩이라, 같은 색이어도
 * 하나는 배경, 하나는 표시로 읽힌다. 비활성 탭은 색을 갖지 않으므로 색이 곧 위치다.
 *
 * **글자는 text-ink(#2A1F14)다. 흰 글자를 쓰지 마라.** 종족색 3종이 전부 밝아
 * 흰 글자는 여우 2.35:1 · 고양이 3.11:1 · 곰 2.56:1로 WCAG AA(4.5:1)에 한참 못 미친다.
 * text-ink는 6.85 · 5.17 · 6.29:1로 전부 통과한다. 2026-08-27 이전 코드의
 * `color: "#fff"`가 바로 그 미달 상태였다 — 되살리지 마라.
 * ─────────────────────────────────────────────────────────────────────────────
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

  const FOCUS_RING =
    "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none"

  /*
   * 트랙이 p-1(4px)이므로 안쪽 탭은 rounded-lg(8px)로 트랙 rounded-xl(12px)보다 한 단 작다.
   * 같은 값이면 안쪽 모서리가 바깥보다 커 보여 어긋난다.
   * shrink-0은 가로 스크롤에서 탭이 찌그러지지 않게 한다.
   */
  const TAB_BASE =
    "shrink-0 rounded-lg px-4 py-2.5 font-display text-base transition duration-150 " + FOCUS_RING

  // 전체 커뮤니티 탭의 활성. 흰 칸 + 옅은 그림자로 트랙 위에 한 겹 올라온 것처럼 보인다
  const TAB_ACTIVE = " bg-card text-ink shadow-sm"

  // 종족 탭의 활성. 배경만 인라인 종족색이고 글자는 위 주석대로 text-ink로 고정한다
  const TAB_ACTIVE_TRIBE = " text-ink shadow-sm"

  // 비활성에 배경을 주지 않는다 — 트랙 위에서 배경이 겹치면 활성과의 구분이 흐려진다.
  // 글자색 변화만으로 충분하고, 그림자·이동은 쓰지 않는다(카드처럼 떠오른다)
  const TAB_INACTIVE = " text-muted hover:text-ink-2"

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
    <nav className="flex items-center gap-3">
      {/* 트랙. 관리자는 탭이 4개라 좁은 화면에서 넘치는데, 그건 여기서 가로 스크롤로 흡수한다 */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-paper-2 p-1">
        <Link href="/community" className={TAB_BASE + (isAll ? TAB_ACTIVE : TAB_INACTIVE)}>
          전체 커뮤니티
        </Link>

        {tribeTabs.map((tribe) => {
          const selected = active === tribe
          const mine = tribe === myTypeCode

          return (
            <Link
              key={tribe}
              href={mine ? "/community?tab=mine" : `/community?tab=${tribe}`}
              className={TAB_BASE + (selected ? TAB_ACTIVE_TRIBE : TAB_INACTIVE)}
              // 종족색은 Tailwind로 표현할 수 없어 인라인이다. **배경에만 쓴다** —
              // 글자에 쓰면 트랙(#EDE5D0) 위에서 대비가 무너진다
              style={selected ? { backgroundColor: TRIBE[tribe].colorHex } : undefined}
            >
              {TRIBE[tribe].animal} 갤러리
            </Link>
          )
        })}
      </div>

      {/* 관리자 표시는 여기 한 곳뿐이다. 링크가 아니라 설명이라 탭으로 오해되지 않게
          테두리·배경 없이 둔다.
          **트랙 밖에 둔다** — 배경 띠 안에 설명문이 들어가면 그것도 탭으로 읽힌다 */}
      {isAdmin && <span className="ml-auto shrink-0 text-xs text-muted">관리자라서 모든 종족 갤러리가 보여요</span>}
    </nav>
  )
}
