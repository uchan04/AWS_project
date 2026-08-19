"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/diagnosis", label: "진단결과" },
  { href: "/missions", label: "미션" },
  { href: "/pet", label: "펫" },
  { href: "/community", label: "커뮤니티" },
  { href: "/chat", label: "챗봇" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky bottom-0 inset-x-0 z-10 flex border-t border-neutral-200 bg-white">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 py-3 text-center text-xs ${
              active ? "font-semibold text-neutral-900" : "text-neutral-500"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
