"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { TRIBE } from "@/lib/types"
import type { SidebarProfile } from "@/lib/profile"
import type { TypeCode } from "@prisma/client"
import styles from "./Sidebar.module.css"

function getBgColor(hex: string): string {
  // colorHex → 배경색 (약한 톤)
  const map: Record<string, string> = {
    "#E8956A": "#FAE8D8", // 여우 주황
    "#6A95C8": "#D8E8FA", // 고양이 파랑
    "#7AAE82": "#D8F0DC", // 곰 초록
  }
  return map[hex] || "#F5F0E8"
}

function getStageEmoji(typeCode: TypeCode | null): string {
  if (!typeCode) return "🌱"
  const tribe = TRIBE[typeCode]
  return tribe.emoji
}

const TABS: { href: string; label: string; emoji: string; desc: string }[] = [
  { href: "/", label: "홈", emoji: "🏡", desc: "오늘 현황" },
  { href: "/missions", label: "미션", emoji: "✅", desc: "작은 한 걸음" },
  { href: "/pet", label: "나의 펫", emoji: "🌱", desc: "함께 성장해요" },
  { href: "/community", label: "커뮤니티", emoji: "💬", desc: "같은 종족 모임" },
]

export function Sidebar({ profile }: { profile: SidebarProfile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [showAccount, setShowAccount] = useState(false)
  const [compact, setCompact] = useState(false)

  // 재화·상태 변경 시 갱신(2026-08-21 A 수정).
  // 프로필은 layout.tsx가 서버에서 읽어 props로 주므로 여기서 fetch하지 않는다.
  // router.refresh()가 레이아웃을 다시 렌더해 새 props를 흘려보낸다 — 요청 1건이고,
  // 이동할 때가 아니라 씨앗·친밀도가 실제로 바뀐 순간에만 나간다.
  useEffect(() => {
    function handleStatsChanged() {
      router.refresh()
    }
    window.addEventListener("user-stats-changed", handleStatsChanged)
    return () => window.removeEventListener("user-stats-changed", handleStatsChanged)
  }, [router])

  // 화면 크기 감지
  useEffect(() => {
    function checkWidth() {
      setCompact(window.innerWidth <= 768)
    }
    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  // 진단/로그인/회원가입 화면에서 숨김
  const hiddenPaths = ["/diagnosis", "/diagnosis/result", "/login", "/signup"]
  if (hiddenPaths.includes(pathname)) {
    return null
  }

  // 미인증이거나 프로필을 못 읽었으면 그리지 않는다. 폴백으로 가짜 프로필을 만들면
  // 미인증에도 "익명 · 미분류 · Lv.1"과 로그아웃 버튼이 뜬다(2026-08-21 제보, A 수정).
  if (!profile) {
    return null
  }

  const tribe = profile.typeCode ? TRIBE[profile.typeCode] : null
  const color = tribe?.colorHex || "#7A6B58"
  const bg = getBgColor(color)
  const familyLabel = tribe?.family || "미분류"
  const joinDate = new Date(profile.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <>
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <h1 className={styles.logoTitle}>함께 걷는 하루</h1>
          <p className={styles.logoSubtitle}>작은 한 걸음, 매일</p>
        </div>

        {/* Profile card */}
        {compact ? (
          <div
            style={{
              margin: "8px",
              background: bg,
              borderRadius: 12,
              padding: "12px 8px",
              display: "flex",
              justifyContent: "center",
            }}
          >
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
                overflow: "hidden",
              }}
            >
              {profile.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.imageUrl}
                  alt="펫"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    if (e.currentTarget.nextSibling) {
                      ;(e.currentTarget.nextSibling as HTMLElement).style.display = "block"
                    }
                  }}
                />
              ) : null}
              <span style={{ display: profile.imageUrl ? "none" : "block" }}>{getStageEmoji(profile.typeCode)}</span>
            </div>
          </div>
        ) : (
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
                  overflow: "hidden",
                }}
              >
                {profile.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.imageUrl}
                    alt="펫"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      if (e.currentTarget.nextSibling) {
                        ;(e.currentTarget.nextSibling as HTMLElement).style.display = "block"
                      }
                    }}
                  />
                ) : null}
                <span style={{ display: profile.imageUrl ? "none" : "block" }}>{getStageEmoji(profile.typeCode)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
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
                  <span style={{ fontSize: 11, color: "#9A8A76", fontWeight: 600 }}>Lv.{profile.level}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color, fontWeight: 700 }}>
                  {tribe?.emoji || "🌱"} {familyLabel}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#7A6B58", marginTop: 8 }}>
              <span>🌱 씨앗 {profile.seeds}개</span>
              <span>💖 친밀도 {profile.affinity}</span>
              <span>⭐ 별조각 {profile.starShards}</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: compact ? "8px 4px" : "8px 12px", overflowY: "auto" }}>
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
                  justifyContent: compact ? "center" : "flex-start",
                  gap: compact ? 0 : 12,
                  padding: compact ? "10px 8px" : "10px 12px",
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
                {compact ? (
                  <span style={{ fontSize: 20 }}>{emoji}</span>
                ) : (
                  <>
                    <span style={{ fontSize: 18, width: 24, textAlign: "center", flexShrink: 0 }}>{emoji}</span>
                    <div>
                      <p
                        className={styles.navLabel}
                        style={{
                          fontWeight: active ? 700 : 500,
                          color: active ? "white" : "#2A1F14",
                        }}
                      >
                        {label}
                      </p>
                      <p className={styles.navDesc} style={{ color: active ? "rgba(255,255,255,0.75)" : "#9A8A76" }}>
                        {desc}
                      </p>
                    </div>
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer — 내 계정 */}
        <div style={{ padding: compact ? "8px 4px 12px" : "12px 16px 20px", borderTop: "1px solid #EDE5D0" }}>
          <button
            onClick={() => setShowAccount(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: compact ? "center" : "flex-start",
              gap: compact ? 0 : 10,
              padding: compact ? "10px 8px" : "10px 12px",
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
            {!compact && (
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
            )}
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
                <div
                  style={{
                    width: 52,
                    height: 52,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 52,
                    overflow: "hidden",
                    borderRadius: "50%",
                  }}
                >
                  {profile.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.imageUrl}
                      alt="펫"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                        if (e.currentTarget.nextSibling) {
                          ;(e.currentTarget.nextSibling as HTMLElement).style.display = "block"
                        }
                      }}
                    />
                  ) : null}
                  <span style={{ display: profile.imageUrl ? "none" : "block" }}>{tribe?.emoji || "🌱"}</span>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 18, color: "#2A1F14", margin: "0 0 3px" }}>
                    {profile.nickname}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color, fontWeight: 700 }}>{familyLabel}</p>
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

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => {
                    window.location.href = "/diagnosis"
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#F5F0E8",
                    border: "1px solid #DDD0BC",
                    borderRadius: 12,
                    fontSize: 13,
                    color: "#5A4A3A",
                    cursor: "pointer",
                    fontWeight: 500,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F0EAD8"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#F5F0E8"
                  }}
                >
                  다시 진단하기
                </button>
                <button
                  onClick={() => {
                    if (!confirm("로그아웃하시겠습니까?")) return
                    // /api/auth/logout은 POST만 받는다(GET으로 열면 405). 쿠키 두 개를 지운다
                    void fetch("/api/auth/logout", { method: "POST", redirect: "manual" }).finally(
                      () => {
                        window.location.href = "/login"
                      }
                    )
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "transparent",
                    border: "1px solid #DDD0BC",
                    borderRadius: 12,
                    fontSize: 13,
                    color: "#9A8A76",
                    cursor: "pointer",
                    fontWeight: 500,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F0EAD8"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                  }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
