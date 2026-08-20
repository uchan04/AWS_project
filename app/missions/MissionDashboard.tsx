"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import styles from "./mission-ui.module.css"
import type { DashboardDTO, MissionDTO } from "@/lib/missions/dashboard"

// ─── 미션 화면 전용 색상 (Figma 원본) ──────────────────────────────────────

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

type CharacterKey = keyof typeof CHARACTER_COLOR

// ─── 애니메이션 매핑 (CSS Module class) ───────────────────────────────────

const ANIM_CLASS: Record<string, string> = {
  walk: styles.mascotWalk,
  stretch: styles.mascotStretch,
  drink: styles.mascotDrink,
  eat: styles.mascotEat,
  rest: styles.mascotRest,
  look: styles.mascotLook,
  write: styles.mascotWrite,
  music: styles.mascotMusic,
  photo: styles.mascotPhoto,
  default: styles.mascotFloat,
}

const ANIM_CAPTION: Record<string, string> = {
  walk: "함께 걷고 있어요 🚶",
  stretch: "기지개를 켜고 있어요 🤸",
  drink: "홀짝홀짝 마시고 있어요 ☕",
  eat: "맛있게 먹고 있어요 😋",
  rest: "포근하게 쉬고 있어요 😴",
  look: "두리번두리번 둘러보고 있어요 🌤️",
  write: "열심히 적고 있어요 ✏️",
  music: "신나게 음악을 즐기고 있어요 🎵",
  photo: "찰칵! 찍고 있어요 📸",
  default: "응원하고 있어요 💚",
}

function getMissionAnimType(mission: { title: string }): string {
  const t = mission.title
  if (/산책|걷|나가/.test(t)) return "walk"
  if (/스트레칭|기지개/.test(t)) return "stretch"
  if (/마시|음료|물|차|코코아/.test(t)) return "drink"
  if (/먹|간식|음식|밥/.test(t)) return "eat"
  if (/쉬|누|자|낮잠|담요|이불/.test(t)) return "rest"
  if (/하늘|창문|햇빛|바깥|환기|창가|커튼/.test(t)) return "look"
  if (/쓰|메모|일기|편지|기록|남기/.test(t)) return "write"
  if (/음악|노래|플레이리스트/.test(t)) return "music"
  if (/그|사진/.test(t)) return "photo"
  return "default"
}

// emoji 보완용 UI map
const EMOJI_BY_KEYWORD: Record<string, string> = {
  커튼: "🪟",
  물: "💧",
  기지개: "🙆",
  커뮤니티: "✏️",
  대화: "💬",
  창문: "🪟",
  그릇: "🍽️",
  냉장고: "🥗",
  돈: "💸",
  현관: "🚪",
  우편함: "📬",
  산책: "🚶",
  가게: "🏪",
  인사: "👋",
  도서관: "📚",
  편의점: "🏪",
  앉기: "🪑",
  이불: "🛏️",
  기분: "😊",
  숨: "💨",
  복도: "🚶",
  병원: "🏥",
  안부: "💌",
  통화: "📞",
  마시기: "☕",
  한끼: "🍽️",
  방문: "🚪",
  집안일: "🧹",
  심부름: "🛍️",
  장보기: "🛒",
  활동: "📋",
}

function getEmojiForMission(title: string): string {
  for (const [key, emoji] of Object.entries(EMOJI_BY_KEYWORD)) {
    if (title.includes(key)) return emoji
  }
  return "✨"
}

// ─── Mission modal ──────────────────────────────────────────────────────────

interface MissionModalProps {
  mission: MissionDTO
  color: string
  bg: string
  mascotEmoji: string
  onClose: () => void
  onComplete: () => void
}

function MissionModal({ mission, color, bg, mascotEmoji, onClose, onComplete }: MissionModalProps) {
  const [proofMode, setProofMode] = useState(false)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const animType = getMissionAnimType(mission)
  const caption = ANIM_CAPTION[animType] ?? ANIM_CAPTION.default
  const emoji = getEmojiForMission(mission.title)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setProofImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  async function handleComplete() {
    if (mission.completionMode === "EVENT") return
    if (mission.requiresPhoto && mission.completionMode === "PHOTO") {
      // TODO: stage 6·7에서 upload → verify 연결
      return
    }

    setCompleting(true)
    setCompleteError(null)

    try {
      const res = await fetch(`/api/missions/${mission.id}/complete`, { method: "POST" })
      const json = await res.json()

      if (!res.ok) {
        setCompleteError(json.error?.message || "완료 중 오류가 발생했습니다")
        return
      }

      onComplete()
      onClose()
      // 사이드바 씨앗 갱신 이벤트
      window.dispatchEvent(new CustomEvent("mission-completed"))
    } catch {
      setCompleteError("네트워크 오류가 발생했습니다")
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="screen-enter"
        style={{
          background: "#FDFBF5",
          borderRadius: 32,
          width: "90%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ background: bg, padding: "36px 32px 32px", textAlign: "center", position: "relative" }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 14,
              right: 18,
              background: "none",
              border: "none",
              fontSize: 22,
              color: "#9A8A76",
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
          <div
            style={{
              fontSize: 120,
              lineHeight: 1,
              display: "inline-block",
            }}
          >
            {mascotEmoji}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#7A6B58", fontWeight: 500 }}>{caption}</p>
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${color}33` }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{emoji}</div>
            <h2
              style={{
                fontFamily: "'Gowun Dodum', sans-serif",
                fontSize: 20,
                color: "#2A1F14",
                margin: "0 0 10px",
              }}
            >
              {mission.title}
            </h2>
            <p style={{ color: "#7A6B58", fontSize: 13, lineHeight: 1.8, margin: 0 }}>{mission.description}</p>
          </div>
        </div>

        <div style={{ padding: "24px 32px 32px", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
            <span
              style={{
                fontSize: 12,
                color: "#7A6B58",
                background: bg,
                padding: "6px 14px",
                borderRadius: 99,
              }}
            >
              🌱 씨앗 +{mission.reward.seeds}
            </span>
            {mission.reward.starShards > 0 && (
              <span
                style={{
                  fontSize: 12,
                  color: "#7A6B58",
                  background: bg,
                  padding: "6px 14px",
                  borderRadius: 99,
                }}
              >
                💎 별조각 +{mission.reward.starShards}
              </span>
            )}
            {mission.reward.affinity > 0 && (
              <span
                style={{
                  fontSize: 12,
                  color: "#7A6B58",
                  background: bg,
                  padding: "6px 14px",
                  borderRadius: 99,
                }}
              >
                💖 친밀도 +{mission.reward.affinity}
              </span>
            )}
          </div>

          {mission.completed ? (
            <div
              style={{
                background: bg,
                borderRadius: 14,
                padding: "16px",
                fontSize: 15,
                color,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              ✓ 오늘 이미 완료했어요!
            </div>
          ) : mission.completionMode === "EVENT" ? (
            <div
              style={{
                background: "#F5F0E8",
                borderRadius: 14,
                padding: "16px",
                fontSize: 13,
                color: "#7A6B58",
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              활동 완료 시 자동으로 반영돼요
            </div>
          ) : (
            <>
              {mission.requiresPhoto && (
                <>
                  <button
                    onClick={() => setProofMode((p) => !p)}
                    style={{
                      width: "100%",
                      background: proofMode ? bg : "#F5F0E8",
                      border: `1.5px solid ${proofMode ? color : "#DDD0BC"}`,
                      borderRadius: 14,
                      padding: "11px",
                      fontSize: 13,
                      color: proofMode ? color : "#7A6B58",
                      cursor: "pointer",
                      marginBottom: 10,
                      fontWeight: proofMode ? 700 : 400,
                      transition: "all 0.18s",
                    }}
                  >
                    📷 사진으로 인증하기 {proofMode ? "▲" : "▼"}
                  </button>

                  {proofMode && (
                    <div style={{ marginBottom: 12 }}>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
                      {proofImage ? (
                        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "16/9" }}>
                          <img src={proofImage} alt="proof" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <button
                            onClick={() => {
                              setProofImage(null)
                              if (fileRef.current) fileRef.current.value = ""
                            }}
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              background: "rgba(0,0,0,0.5)",
                              border: "none",
                              borderRadius: "50%",
                              width: 28,
                              height: 28,
                              color: "white",
                              fontSize: 14,
                              cursor: "pointer",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileRef.current?.click()}
                          style={{
                            width: "100%",
                            height: 160,
                            background: "#F5F0E8",
                            border: `1.5px dashed #DDD0BC`,
                            borderRadius: 14,
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#7A6B58",
                          }}
                        >
                          + 사진 선택
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {completeError && (
                <p style={{ fontSize: 13, color: "#A9542A", marginBottom: 12, textAlign: "center" }}>{completeError}</p>
              )}

              <button
                onClick={handleComplete}
                disabled={completing || (mission.requiresPhoto && !proofImage)}
                style={{
                  width: "100%",
                  background: color,
                  color: "white",
                  border: "none",
                  borderRadius: 14,
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: completing || (mission.requiresPhoto && !proofImage) ? "not-allowed" : "pointer",
                  opacity: completing || (mission.requiresPhoto && !proofImage) ? 0.4 : 1,
                }}
              >
                {completing ? "완료 중..." : "완료했어요 ✓"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step section ───────────────────────────────────────────────────────────

interface StepSectionProps {
  title: string
  subtitle?: string
  missions: MissionDTO[]
  color: string
  bg: string
  mascotEmoji: string
  unlocked?: boolean
  progress?: string
  onSelect: (m: MissionDTO) => void
}

function StepSection({ title, subtitle, missions, color, bg, unlocked = true, progress, onSelect }: StepSectionProps) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2
            style={{
              fontFamily: "'Gowun Dodum', sans-serif",
              fontSize: 19,
              color: "#2A1F14",
              margin: 0,
            }}
          >
            {title}
          </h2>
          {subtitle && <p style={{ fontSize: 12, color: "#7A6B58", margin: "4px 0 0" }}>{subtitle}</p>}
        </div>
        {progress && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color,
              background: bg,
              padding: "6px 14px",
              borderRadius: 99,
            }}
          >
            {progress}
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {missions.map((m) => {
          const locked = !unlocked
          const emoji = getEmojiForMission(m.title)

          return (
            <button
              key={m.id}
              onClick={() => !locked && onSelect(m)}
              disabled={locked}
              style={{
                background: m.completed ? bg : "#FDFBF5",
                border: `1.5px solid ${m.completed ? color : "#EDE5D0"}`,
                borderRadius: 16,
                padding: "18px 14px",
                cursor: locked ? "not-allowed" : "pointer",
                textAlign: "center",
                opacity: locked ? 0.5 : 1,
                transition: "all 0.15s",
              }}
              className={styles.missionCard}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{locked ? "🔒" : emoji}</div>
              <p
                style={{
                  fontFamily: "'Gowun Dodum', sans-serif",
                  fontSize: 13,
                  color: "#2A1F14",
                  margin: 0,
                  lineHeight: 1.4,
                  fontWeight: m.completed ? 700 : 500,
                }}
              >
                {m.title}
              </p>
              {m.completed && (
                <span style={{ fontSize: 11, color, marginTop: 6, display: "block" }}>✓ 완료</span>
              )}
              {!m.completed && (
                <div style={{ marginTop: 8, fontSize: 10, color: "#7A6B58", display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                  {m.reward.seeds > 0 && <span>🌱 {m.reward.seeds}</span>}
                  {m.reward.affinity > 0 && <span>💖 {m.reward.affinity}</span>}
                  {m.reward.starShards > 0 && <span>⭐ {m.reward.starShards}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ─── Progress card ─────────────────────────────────────────────────────────

interface ProgressCardProps {
  title: string
  value: string
  color: string
  bg: string
}

function ProgressCard({ title, value, color, bg }: ProgressCardProps) {
  return (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${color}33`,
        borderRadius: 16,
        padding: "14px 18px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 12, color: "#7A6B58", margin: "0 0 6px" }}>{title}</p>
      <p
        style={{
          fontFamily: "'Gowun Dodum', sans-serif",
          fontSize: 22,
          color,
          fontWeight: 700,
          margin: 0,
        }}
      >
        {value}
      </p>
    </div>
  )
}

// ─── Attendance calendar ───────────────────────────────────────────────────

interface AttendanceCalendarProps {
  cycleDay: number
  claimedToday: boolean
  attendanceTotal: number
  color: string
  bg: string
  onClaim: () => void
}

function AttendanceCalendar({ cycleDay, claimedToday, attendanceTotal, color, bg, onClaim }: AttendanceCalendarProps) {
  const [claiming, setClaiming] = useState(false)

  async function handleClaim() {
    setClaiming(true)
    try {
      const res = await fetch("/api/missions/attendance/claim", { method: "POST" })
      const json = await res.json()

      if (res.ok && !json.data.alreadyClaimed) {
        onClaim()
        window.dispatchEvent(new CustomEvent("mission-completed"))
      }
    } catch {
      // silent
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${color}33`,
        borderRadius: 16,
        padding: "20px",
      }}
    >
      <h3
        style={{
          fontFamily: "'Gowun Dodum', sans-serif",
          fontSize: 16,
          color: "#2A1F14",
          margin: "0 0 12px",
        }}
      >
        출석 캘린더
      </h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const done = attendanceTotal >= day || (day === cycleDay && claimedToday)
          return (
            <div
              key={day}
              style={{
                flex: 1,
                background: done ? color : "#F5F0E8",
                color: done ? "white" : "#9A8A76",
                borderRadius: 10,
                padding: "10px 4px",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {day}일
            </div>
          )
        })}
      </div>
      {claimedToday ? (
        <p style={{ fontSize: 13, color, textAlign: "center", margin: 0 }}>✓ 오늘 출석 완료</p>
      ) : (
        <button
          onClick={handleClaim}
          disabled={claiming}
          style={{
            width: "100%",
            background: color,
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "12px",
            fontSize: 14,
            fontWeight: 700,
            cursor: claiming ? "not-allowed" : "pointer",
            opacity: claiming ? 0.5 : 1,
          }}
        >
          {claiming ? "수령 중..." : "오늘 출석 받기"}
        </button>
      )}
    </div>
  )
}

// ─── Main dashboard ────────────────────────────────────────────────────────

export default function MissionDashboard() {
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MissionDTO | null>(null)
  const [currentStageIndex, setCurrentStageIndex] = useState(0)

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/missions")
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || "미션을 불러올 수 없습니다")
        setLoading(false)
        return
      }
      setDashboard(json.data)
      setLoading(false)
    } catch {
      setError("네트워크 오류가 발생했습니다")
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await fetch("/api/missions")
        const json = await res.json()
        if (!mounted) return
        if (!res.ok) {
          setError(json.error?.message || "미션을 불러올 수 없습니다")
          setLoading(false)
          return
        }
        setDashboard(json.data)
        setLoading(false)
      } catch {
        if (!mounted) return
        setError("네트워크 오류가 발생했습니다")
        setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <p style={{ fontSize: 15, color: "#7A6B58" }}>미션을 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <p style={{ fontSize: 15, color: "#A9542A", marginBottom: 20 }}>{error}</p>
        <button
          onClick={loadDashboard}
          style={{
            background: "#4B7A5B",
            color: "white",
            border: "none",
            borderRadius: 14,
            padding: "12px 24px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (!dashboard) return null

  // TODO: 사용자 캐릭터를 User.typeCode 기반으로 결정
  const character: CharacterKey = "cat"
  const color = CHARACTER_COLOR[character]
  const bg = CHARACTER_BG[character]
  const mascotEmoji = CHARACTER_EMOJI[character]

  const handleComplete = () => {
    // 완료 후 dashboard 재조회
    loadDashboard()
  }

  return (
    <div style={{ padding: "32px 20px", maxWidth: 840, margin: "0 auto" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{mascotEmoji}</div>
        <h1
          style={{
            fontFamily: "'Gowun Dodum', sans-serif",
            fontSize: 26,
            color: "#2A1F14",
            margin: "0 0 8px",
          }}
        >
          오늘의 미션
        </h1>
        <p style={{ fontSize: 14, color: "#7A6B58", margin: 0 }}>작은 한 걸음씩, 함께 걸어가요</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <ProgressCard
          title="오늘 달성률"
          value={`${dashboard.progress.dailyCompleted} / ${dashboard.progress.dailyTotal}`}
          color={color}
          bg={bg}
        />
        <ProgressCard
          title="이번 주"
          value={`${dashboard.progress.weeklyCompleted} / ${dashboard.progress.weeklyTotal}`}
          color={color}
          bg={bg}
        />
        <ProgressCard title="연속 달성" value={`${dashboard.progress.streak}일`} color={color} bg={bg} />
      </div>

      <div style={{ marginBottom: 36 }}>
        <AttendanceCalendar
          cycleDay={dashboard.attendance.cycleDay}
          claimedToday={dashboard.attendance.claimedToday}
          attendanceTotal={dashboard.attendance.attendanceTotal}
          color={color}
          bg={bg}
          onClaim={handleComplete}
        />
      </div>

      <StepSection
        title="일일 미션"
        subtitle="매일 새롭게 시작해요"
        missions={dashboard.dailyMissions}
        color={color}
        bg={bg}
        mascotEmoji={mascotEmoji}
        progress={`${dashboard.progress.dailyCompleted} / ${dashboard.progress.dailyTotal}`}
        onSelect={setSelected}
      />

      {(() => {
        // 완료되지 않은 단계들만 표시
        const incompleteMissions = dashboard.stageMissions.filter((sm) => sm.unlocked && sm.completedCount < 4)
        if (incompleteMissions.length === 0) return null

        const currentMission = incompleteMissions[currentStageIndex]
        const hasPrev = currentStageIndex > 0
        const hasNext = currentStageIndex < incompleteMissions.length - 1

        return (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h2
                  style={{
                    fontFamily: "'Gowun Dodum', sans-serif",
                    fontSize: 19,
                    color: "#2A1F14",
                    margin: 0,
                  }}
                >
                  추가 미션
                </h2>
                <p style={{ fontSize: 12, color: "#7A6B58", margin: "4px 0 0" }}>
                  단계를 완료하면 새로운 미션이 열려요
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setCurrentStageIndex((i) => Math.max(0, i - 1))}
                  disabled={!hasPrev}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: hasPrev ? color : "#F5F0E8",
                    color: hasPrev ? "white" : "#DDD0BC",
                    border: "none",
                    cursor: hasPrev ? "pointer" : "not-allowed",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ←
                </button>
                <button
                  onClick={() => {
                    if (hasNext) {
                      setCurrentStageIndex((i) => Math.min(incompleteMissions.length - 1, i + 1))
                    } else {
                      alert("아직 단계 " + currentMission.stage + "을 완료하지 않았어요")
                    }
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: color,
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  →
                </button>
              </div>
            </div>
            <StepSection
              title={`단계 ${currentMission.stage}`}
              missions={currentMission.missions}
              color={color}
              bg={bg}
              mascotEmoji={mascotEmoji}
              unlocked={currentMission.unlocked}
              progress={`${currentMission.completedCount} / 4 완료`}
              onSelect={setSelected}
            />
          </div>
        )
      })()}

      {selected && (
        <MissionModal
          mission={selected}
          color={color}
          bg={bg}
          mascotEmoji={mascotEmoji}
          onClose={() => setSelected(null)}
          onComplete={handleComplete}
        />
      )}
    </div>
  )
}
