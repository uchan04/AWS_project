"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

// TODO: 실제 사용자 API 연결 시 제거. 임시 프로필 데이터.
const TEMP_SIDEBAR_PROFILE = {
  nickname: "고요한 고양이",
  character: "cat" as const,
  seeds: 42,
  level: 3,
  createdAt: "2026-08-15",
}

const CHARACTER_COLOR = {
  fox: "#E8956A",
  cat: "#6A95C8",
  bear: "#7AAE82",
}

const CHARACTER_BG = {
  fox: "#FAE8D8",
  cat: "#D8E8FA",
  bear: "#D8F0DC",
}

const CHARACTER_EMOJI = {
  fox: "🦊",
  cat: "🐱",
  bear: "🐻",
}

const CHARACTER_LABEL = {
  fox: "개과",
  cat: "고양잇과",
  bear: "곰과",
}

// 펫 이모지 (임시)
function petEmoji(character: keyof typeof CHARACTER_EMOJI, level: number): string {
  const emojis = {
    fox: ["🦊", "🦊", "🦊"],
    cat: ["🐱", "🐈", "🐈‍⬛"],
    bear: ["🐻", "🐻", "🐻"],
  }
  const stage = level >= 15 ? 2 : level >= 5 ? 1 : 0
  return emojis[character][stage]
}

const TABS: { href: string; label: string; emoji: string; desc: string }[] = [
  { href: "/", label: "홈", emoji: "🏡", desc: "오늘 현황" },
  { href: "/missions", label: "미션", emoji: "✅", desc: "작은 한 걸음" },
  { href: "/pet", label: "나의 펫", emoji: "🌱", desc: "함께 성장해요" },
  { href: "/community", label: "커뮤니티", emoji: "💬", desc: "같은 종족 모임" },
]

export function Sidebar() {
  const pathname = usePathname()
  const [showAccount, setShowAccount] = useState(false)

  const profile = TEMP_SIDEBAR_PROFILE
  const color = CHARACTER_COLOR[profile.character]
  const bg = CHARACTER_BG[profile.character]
  const joinDate = new Date(profile.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: "#FDFBF5",
          borderRight: "1px solid #DDD0BC",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "28px 24px 20px", borderBottom: "1px solid #EDE5D0" }}>
          <h1
            style={{
              fontFamily: "'Gowun Dodum', sans-serif",
              fontSize: 18,
              color: "#2A1F14",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            함께 걷는 하루
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9A8A76" }}>작은 한 걸음, 매일</p>
        </div>

        {/* Profile card */}
        <div style={{ margin: "16px 16px 8px", background: bg, borderRadius: 16, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {petEmoji(profile.character, profile.level)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: "'Gowun Dodum', sans-serif",
                  fontSize: 14,
                  color: "#2A1F14",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profile.nickname}
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 11, color, fontWeight: 700 }}>
                {CHARACTER_EMOJI[profile.character]} {CHARACTER_LABEL[profile.character]}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7A6B58" }}>
            <span>🌱 씨앗 {profile.seeds}개</span>
            <span>Lv.{profile.level}</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 12px", overflowY: "auto" }}>
          {TABS.map(({ href, label, emoji, desc }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: 12,
                  background: active ? color : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 2,
                  transition: "all 0.15s",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "#F0EAD8"
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent"
                }}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: "center", flexShrink: 0 }}>{emoji}</span>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? "white" : "#2A1F14",
                      fontFamily: "'Noto Sans KR', sans-serif",
                    }}
                  >
                    {label}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: active ? "rgba(255,255,255,0.75)" : "#9A8A76" }}>{desc}</p>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer — 내 계정 */}
        <div style={{ padding: "12px 16px 20px", borderTop: "1px solid #EDE5D0" }}>
          <button
            onClick={() => setShowAccount(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              border: "1px solid #DDD0BC",
              borderRadius: 12,
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F0EAD8"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
            }}
          >
            <span style={{ fontSize: 16 }}>👤</span>
            <span
              style={{
                fontSize: 13,
                color: "#5A4A3A",
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: 500,
              }}
            >
              내 계정
            </span>
          </button>
        </div>
      </aside>

      {/* Account modal */}
      {showAccount && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(42,31,20,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowAccount(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="screen-enter"
            style={{
              background: "#FDFBF5",
              borderRadius: 28,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 32px 80px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "24px 28px 20px",
                borderBottom: "1px solid #EDE5D0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 18, color: "#2A1F14", margin: 0 }}>내 계정</h2>
              <button
                onClick={() => setShowAccount(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#F0EAD8",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#7A6B58",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "24px 28px 28px" }}>
              <div
                style={{
                  background: bg,
                  borderRadius: 20,
                  padding: "20px",
                  marginBottom: 16,
                  border: `1px solid ${color}33`,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div style={{ fontSize: 52 }}>{CHARACTER_EMOJI[profile.character]}</div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 18, color: "#2A1F14", margin: "0 0 3px" }}>
                    {profile.nickname}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color, fontWeight: 700 }}>{CHARACTER_LABEL[profile.character]}</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "펫 레벨", value: `Lv.${profile.level}`, emoji: "⭐" },
                  { label: "보유 씨앗", value: `${profile.seeds}개`, emoji: "🌱" },
                  { label: "시작한 날", value: joinDate, emoji: "📅" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 14px",
                      background: "#F5F0E8",
                      borderRadius: 14,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{item.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 10, color: "#9A8A76" }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#2A1F14", fontWeight: 600 }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 12, color: "#9A8A76", textAlign: "center" }}>
                실제 사용자 정보는 추후 API 연결 예정
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
