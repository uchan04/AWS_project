"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { TRIBE } from "@/lib/types"
import type { SidebarProfile } from "@/lib/profile"
import type { TypeCode } from "@prisma/client"
import styles from "./Sidebar.module.css"
import { useModalA11y } from "./useModalA11y"
import { ArtImage } from "./ArtImage"

function getBgColor(hex: string): string {
  // colorHex → 배경색 (약한 톤)
  const map: Record<string, string> = {
    "#E8956A": "#FAE8D8", // 여우 주황
    "#6A95C8": "#D8E8FA", // 고양이 파랑
    "#7AAE82": "#D8F0DC", // 곰 초록
  }
  return map[hex] || "#F5F0E8"
}

function getTribeEmoji(typeCode: TypeCode | null): string {
  if (!typeCode) return "🌱"
  const tribe = TRIBE[typeCode]
  return tribe.emoji
}

const TABS: { href: string; label: string; emoji: string; desc: string }[] = [
  { href: "/", label: "홈", emoji: "🏡", desc: "오늘 현황" },
  { href: "/missions", label: "미션", emoji: "✅", desc: "작은 한 걸음" },
  { href: "/pet", label: "나의 펫", emoji: "🌱", desc: "함께 성장해요" },
  { href: "/community", label: "커뮤니티", emoji: "💬", desc: "같은 종족 이야기" },
  { href: "/community/meetups", label: "모임", emoji: "🤝", desc: "오프라인에서 만나기" },
]

/**
 * 프로필 아바타 원. 좁은 폭 사이드바·넓은 폭 사이드바·내 계정 모달 세 곳이
 * **같은 22줄을 복사**하고 있었다(2026-08-23 정리). 값은 크기와 배경뿐이 달랐다.
 *
 * 이미지가 404면 종족 이모지로 떨어진다. 404는 서버가 알 수 없어 onError로만
 * 알 수 있으므로(ArtImage) <img>와 <span>을 둘 다 그려 두고 display로 가린다.
 */
function Avatar({
  imageUrl,
  emoji,
  size,
  fontSize = 22,
  plain = false,
}: {
  imageUrl: string | null
  emoji: string
  size: number
  fontSize?: number
  /** 모달 쪽은 흰 원판 없이 그림만 쓴다 */
  plain?: boolean
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: plain ? undefined : "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        overflow: "hidden",
      }}
    >
      {imageUrl ? (
        <ArtImage
          src={imageUrl}
          alt="펫"
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          fallbackDisplay="block"
        />
      ) : null}
      <span style={{ display: imageUrl ? "none" : "block" }}>{emoji}</span>
    </div>
  )
}

export function Sidebar({ profile }: { profile: SidebarProfile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  // 내 계정 모달. 열린 상태를 boolean이 아니라 **열었던 경로**로 들고 있다 (2026-08-24 제보).
  //
  // 전에는 boolean이라 "계정 설정"을 눌러 /settings로 가도 모달이 그 위에 그대로 떠 있었다 —
  // 사이드바는 루트 레이아웃에 있어 클라이언트 이동으로 언마운트되지 않으므로 상태가 남는다.
  // "이름 바꾸기"에서 증상이 안 보였던 건 목적지 /diagnosis/result가 hiddenPaths라
  // 사이드바 자체가 사라졌기 때문이고 버튼이 옳았던 게 아니다.
  //
  // 경로를 담으면 이동하는 순간 pathname이 달라져 저절로 닫힌다. 버튼마다
  // setShowAccount(false)를 붙이는 것보다 짧고, 링크가 늘어도 같은 버그가 다시 나지 않는다.
  // useEffect로 동기화하지 않는 이유는 react-hooks/set-state-in-effect다 — effect 안의
  // setState는 렌더를 한 번 더 유발하고, 여기서는 렌더 중에 값을 유도할 수 있다.
  const [accountOpenAt, setAccountOpenAt] = useState<string | null>(null)
  const showAccount = accountOpenAt === pathname
  const setShowAccount = (open: boolean) => setAccountOpenAt(open ? pathname : null)
  // narrow: 창이 좁아 자동으로 접힌 상태. collapsed: 사용자가 버튼으로 접은 상태.
  // 둘을 나눠 둔 것은 넓은 화면에서도 직접 접을 수 있어야 하기 때문이다.
  const [narrow, setNarrow] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const compact = narrow || collapsed

  // 내 계정 모달: Escape로 닫기 · 초점 가두기 · 닫을 때 "내 계정" 버튼으로 초점 되돌리기.
  // 모달을 조건부로 그리므로 showAccount를 같이 넘긴다(app/components/useModalA11y.ts)
  const accountBoxRef = useModalA11y(() => setShowAccount(false), showAccount)

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
      setNarrow(window.innerWidth <= 768)
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

  // 진단 전에는 그리지 않는다 (2026-08-24 제보). 위 hiddenPaths가 /login·/diagnosis는
  // 막지만 **진단 시작 대기 화면은 "/"**다 — app/page.tsx:66이 typeCode·adjective가
  // 없으면 그 경로에서 <Intro authed />를 그린다. 경로로는 홈과 구분할 수 없으므로
  // 조건으로 막는다. 판정은 profile.diagnosed 하나만 쓴다(lib/profile.ts) — 그 값이
  // page.tsx와 같은 식이고, 여기에 `!typeCode || !adjective`를 다시 쓰면 두 벌이 된다.
  //
  // 진단 전 사이드바는 갈 곳이 없다: 펫·미션·커뮤니티가 전부 종족과 유형에 매여 있어
  // 눌러도 빈 화면이거나 에러다. 챗봇 버튼도 같은 값으로 이미 숨는다(ChatLauncher).
  if (!profile.diagnosed) {
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
      <aside className={compact ? `${styles.sidebar} ${styles.rail}` : styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <h1 className={styles.logoTitle}>모꼬지</h1>
          <p className={styles.logoSubtitle}>작은 한 걸음, 매일</p>
          {/* 접기 토글. 창이 좁아 자동으로 접힌 상태에서는 폭을 CSS가 고정하므로 숨긴다 */}
          {!narrow && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className={styles.railToggle}
            >
              {collapsed ? "»" : "«"}
            </button>
          )}
        </div>

        {/* Profile card */}
        {compact ? (
          // 접힌 상태 카드. 둥근 모서리·종족색 배경은 유지하고 레일 폭(64px)을
          // 거의 채우도록 좌우 마진을 4px로 줄였다 — 56×48로 가로가 조금 길다.
          // 안쪽 흰 원은 뺐고 펫 이미지 대신 종족 아이콘(🦊·🐱·🐻)을 쓴다.
          // 아이콘은 내비와 같은 방식으로 둔다 — flex 중앙 + fontSize만.
          // lineHeight를 건드리면 이모지 글리프가 줄 상자 안에서 위로 밀린다.
          <div
            style={{
              margin: "8px 4px",
              height: 48,
              background: bg,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Avatar imageUrl={profile.imageUrl} emoji={getTribeEmoji(profile.typeCode)} size={40} />
          </div>
        ) : (
          <div style={{ margin: "16px 16px 8px", background: bg, borderRadius: 16, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar imageUrl={profile.imageUrl} emoji={getTribeEmoji(profile.typeCode)} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
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
                  fontFamily: "var(--font-body)",
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
            ref={accountBoxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            tabIndex={-1}
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
              <h2
                id="account-modal-title"
                style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#2A1F14", margin: 0 }}
              >
                내 계정
              </h2>
              <button
                type="button"
                onClick={() => setShowAccount(false)}
                aria-label="내 계정 창 닫기"
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
                <Avatar
                  imageUrl={profile.imageUrl}
                  emoji={getTribeEmoji(profile.typeCode)}
                  size={52}
                  fontSize={52}
                  plain
                />
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#2A1F14", margin: "0 0 3px" }}>
                    {profile.nickname}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color, fontWeight: 700 }}>{familyLabel}</p>
                  {/* 정보 칸 3개(펫 레벨·보유 씨앗·시작한 날)를 지우고 시작한 날만 여기로 옮겼다
                      (2026-08-23). 이 모달은 사이드바 **위에** 열리는데 사이드바 프로필 카드가
                      `Lv.N`과 `🌱 씨앗 N개`를 이미 말하고 있다 — 같은 값이 60px 옆에 두 번이었다.
                      시작한 날만 사이드바에 없는 정보다. 모달이 실제로 하는 일은 정보 표시가
                      아니라 행동 3개(이름 바꾸기·계정 설정·로그아웃)다.
                      덤으로 `1fr 1fr` 격자에 항목 3개라 마지막 칸이 혼자 한 줄이던 것도 없어졌다 */}
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: "#7A6B58" }}>📅 {joinDate}부터</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* 재진단은 잠겼다(lib/diagnosis/flags.ts, 2026-08-22 A). 같은 자리를 이름 바꾸기로 쓴다 —
                    결과 화면에 이름 입력이 이미 있고, 그 화면으로 가는 입구가 하단 탭뿐이었다 */}
                <button
                  onClick={() => {
                    router.push("/diagnosis/result")
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
                  이름 바꾸기
                </button>
                {/* 계정 설정(비밀번호 변경·탈퇴) 입구. 2026-08-22 A 추가 —
                    가입 이후 계정을 손댈 수 있는 화면이 하나도 없었다 */}
                <button
                  onClick={() => {
                    router.push("/settings")
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
                  계정 설정
                </button>
                <button
                  onClick={() => {
                    if (!confirm("로그아웃하시겠습니까?")) return
                    // /api/auth/logout은 POST만 받는다(GET으로 열면 405). 쿠키 두 개를 지운다
                    void fetch("/api/auth/logout", { method: "POST", redirect: "manual" }).finally(
                      () => {
                        // 로그아웃은 일부러 전체 새로고침이다. router.push는 RSC 캐시를 남겨
                        // 쿠키가 지워진 뒤에도 사이드바가 방금 로그아웃한 사람의 닉네임·재화를
                        // 그대로 보여준다(lib/profile.ts는 루트 레이아웃에서 한 번만 읽는다).
                        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
