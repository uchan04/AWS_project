import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import type { GalleryTab } from "../_lib/gallery"

/** 갤러리 탭은 2개다: 전체 커뮤니티 / 나의 종족. 종족 갤러리는 진단을 마친 유저에게만 노출한다. */
export function GalleryTabs({ active, myTypeCode }: { active: GalleryTab; myTypeCode: TypeCode | null }) {
  const isAll = active === "ALL"

  return (
    <nav className="flex gap-2">
      <Link
        href="/community"
        className={
          "rounded-xl border px-5 py-2.5 text-sm font-semibold transition " +
          (isAll
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50")
        }
      >
        전체 커뮤니티
      </Link>

      {myTypeCode && (
        <Link
          href="/community?tab=mine"
          className="flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition"
          style={
            isAll
              ? { borderColor: TRIBE[myTypeCode].colorHex, color: TRIBE[myTypeCode].colorHex, backgroundColor: "#fff" }
              : { borderColor: TRIBE[myTypeCode].colorHex, backgroundColor: TRIBE[myTypeCode].colorHex, color: "#fff" }
          }
        >
          {TRIBE[myTypeCode].animal} 갤러리
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: isAll ? `${TRIBE[myTypeCode].colorHex}22` : "rgba(255,255,255,0.25)" }}
          >
            나의 종족
          </span>
        </Link>
      )}
    </nav>
  )
}
