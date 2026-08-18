import Link from "next/link"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"

const GALLERY_ORDER: TypeCode[] = ["INDEPENDENT_LOW_INCOME", "HEALTH_EMOTION", "FAMILY_LIVING"]

export function GalleryTabs({ active }: { active: TypeCode }) {
  return (
    <nav className="flex gap-2">
      {GALLERY_ORDER.map((type) => {
        const tribe = TRIBE[type]
        const isActive = type === active
        return (
          <Link
            key={type}
            href={`/community/${type}`}
            className="flex-1 rounded-lg border px-3 py-2 text-center text-sm font-medium transition"
            style={
              isActive
                ? { backgroundColor: tribe.colorHex, borderColor: tribe.colorHex, color: "#fff" }
                : { borderColor: tribe.colorHex, color: tribe.colorHex }
            }
          >
            {tribe.family}
            <span className="block text-xs opacity-80">{tribe.animal} 갤러리</span>
          </Link>
        )
      })}
    </nav>
  )
}
