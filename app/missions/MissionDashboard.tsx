"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import styles from "./mission-ui.module.css"
import type { DashboardDTO, MissionDTO } from "@/lib/missions/dashboard"
import { AttendanceCalendar } from "./AttendanceCalendar"

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
  /** 내 펫 이미지. null이면 이모지로 떨어진다 */
  petImageUrl: string | null
  onClose: () => void
  onComplete: () => void
}

function MissionModal({ mission, color, bg, mascotEmoji, petImageUrl, onClose, onComplete }: MissionModalProps) {
  const [proofMode, setProofMode] = useState(false)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [petImageFailed, setPetImageFailed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const animType = getMissionAnimType(mission)
  const emoji = getEmojiForMission(mission.title)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setProofImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  async function handleComplete() {
    if (mission.completionMode === "EVENT") return

    if (mission.requiresPhoto && mission.completionMode === "PHOTO") {
      if (!uploadedFile) {
        setCompleteError("사진을 선택해 주세요")
        return
      }

      setCompleting(true)
      setCompleteError(null)

      try {
        // 1. presigned URL 받기
        const presignRes = await fetch("/api/missions/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: uploadedFile.type }),
        })
        const presignJson = await presignRes.json()

        if (!presignRes.ok) {
          setCompleteError(presignJson.error?.message || "업로드 URL 생성 실패")
          return
        }

        const { uploadUrl, fileKey } = presignJson.data

        // 2. S3에 직접 업로드
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: uploadedFile,
          headers: { "Content-Type": uploadedFile.type },
        })

        if (!uploadRes.ok) {
          setCompleteError("이미지 업로드 실패")
          return
        }

        // 3. Bedrock Vision 검증
        const verifyRes = await fetch("/api/missions/upload/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ missionId: mission.id, fileKey }),
        })
        const verifyJson = await verifyRes.json()

        if (!verifyRes.ok) {
          setCompleteError(verifyJson.error?.message || "검증 중 오류 발생")
          return
        }

        if (!verifyJson.data.passed) {
          setCompleteError(`인증 실패: ${verifyJson.data.reason}`)
          return
        }

        if (verifyJson.data.alreadyCompleted) {
          setCompleteError("이미 완료한 미션입니다")
          return
        }

        onComplete()
        onClose()
        window.dispatchEvent(new CustomEvent("user-stats-changed"))
      } catch {
        setCompleteError("네트워크 오류가 발생했습니다")
      } finally {
        setCompleting(false)
      }
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
      window.dispatchEvent(new CustomEvent("user-stats-changed"))
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
          {/* 미션 아이콘 → 캐릭터 → 제목 → 설명. 애니메이션 칸과 아이콘 칸을 한 칸으로 합쳤다 */}
          <div style={{ fontSize: 34, lineHeight: 1 }}>{emoji}</div>
          {/* 캐릭터 칸. 미션별 자산을 그리는 대신 (내 펫 이미지) × (동작 CSS 애니메이션)으로
              조합한다 — 미션이 늘어도 자산은 늘지 않는다. 이미지를 못 읽으면 이모지로 떨어진다 */}
          <div
            className={ANIM_CLASS[animType] ?? ANIM_CLASS.default}
            style={{
              fontSize: 176,
              lineHeight: 1,
              display: "inline-block",
              margin: "12px 0 16px",
            }}
          >
            {petImageUrl && !petImageFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={petImageUrl}
                alt="내 펫"
                // 펫 PNG는 가로가 긴 비율이다. 높이를 이모지 칸과 같은 176px로 잡고
                // contain으로 맞춰야 사이드바처럼 잘리지 않는다
                style={{ height: 176, maxWidth: "100%", objectFit: "contain", display: "block" }}
                onError={() => setPetImageFailed(true)}
              />
            ) : (
              mascotEmoji
            )}
          </div>
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
                      <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: "none" }} onChange={handleFile} />
                      {proofImage ? (
                        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "16/9" }}>
                          <img src={proofImage} alt="proof" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <button
                            onClick={() => {
                              setProofImage(null)
                              setUploadedFile(null)
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
                disabled={completing || (mission.requiresPhoto && !uploadedFile)}
                style={{
                  width: "100%",
                  background: color,
                  color: "white",
                  border: "none",
                  borderRadius: 14,
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: completing || (mission.requiresPhoto && !uploadedFile) ? "not-allowed" : "pointer",
                  opacity: completing || (mission.requiresPhoto && !uploadedFile) ? 0.4 : 1,
                }}
              >
                {completing ? (mission.requiresPhoto ? "검증 중..." : "완료 중...") : "완료했어요 ✓"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Carousel arrows ────────────────────────────────────────────────────────
// 일일 미션과 추가 미션이 같은 화살표를 쓴다. 넘기는 단위만 각자 다르다.

function CarouselArrows({
  color,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  children,
}: {
  color: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  children: React.ReactNode
}) {
  const arrowStyle = (enabled: boolean): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(0%) scaleX(0.7)",
    background: "transparent",
    color: enabled ? color : "#DDD0BC",
    border: "none",
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: 32,
    zIndex: 10,
    padding: 0,
    lineHeight: 1,
  })

  return (
    <div style={{ position: "relative" }}>
      <button onClick={onPrev} disabled={!hasPrev} style={{ ...arrowStyle(hasPrev), left: -32 }}>
        ◀
      </button>
      <button onClick={onNext} disabled={!hasNext} style={{ ...arrowStyle(hasNext), right: -32 }}>
        ▶
      </button>
      {children}
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

// ─── Main dashboard ────────────────────────────────────────────────────────

export default function MissionDashboard() {
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MissionDTO | null>(null)
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [dailyIndex, setDailyIndex] = useState(0)

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
  // typeCode에서 종족 매핑
  const typeCode = dashboard.userTypeCode
  let character: CharacterKey = "cat"
  if (typeCode) {
    if (typeCode.includes("HEALTH_EMOTION")) character = "fox"
    else if (typeCode.includes("INDEPENDENT_LOW_INCOME")) character = "cat"
    else if (typeCode.includes("FAMILY_LIVING")) character = "bear"
  }
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
          streak={dashboard.progress.streak}
          todayKey={dashboard.attendance.todayKey}
          month={dashboard.attendance.month}
          claimedDates={dashboard.attendance.claimedDates}
          color={color}
          bg={bg}
          onRefresh={loadDashboard}
        />
      </div>

      {(() => {
        // 일일 미션도 화살표로 넘긴다. 한 번에 PAGE개를 보이고 1칸씩 밀어
        // 카드 크기를 추가 미션과 같게 유지한다(마지막 페이지가 1장만 남는 것을 막는다).
        const PAGE = 4
        const all = dashboard.dailyMissions
        const maxStart = Math.max(0, all.length - PAGE)
        const start = Math.min(dailyIndex, maxStart)
        const shown = all.slice(start, start + PAGE)

        return (
          <div style={{ marginBottom: 36 }}>
            <CarouselArrows
              color={color}
              hasPrev={start > 0}
              hasNext={start < maxStart}
              onPrev={() => setDailyIndex((i) => Math.max(0, i - 1))}
              onNext={() => setDailyIndex((i) => Math.min(maxStart, i + 1))}
            >
              <StepSection
                title="일일 미션"
                subtitle="매일 새롭게 시작해요"
                missions={shown}
                color={color}
                bg={bg}
                mascotEmoji={mascotEmoji}
                progress={`${dashboard.progress.dailyCompleted} / ${dashboard.progress.dailyTotal}`}
                onSelect={setSelected}
              />
            </CarouselArrows>
          </div>
        )
      })()}

      {(() => {
        // 모든 단계 표시 (잠김 포함)
        const allMissions = dashboard.stageMissions
        if (allMissions.length === 0) return null

        const currentMission = allMissions[currentStageIndex]
        const hasPrev = currentStageIndex > 0
        const hasNext = currentStageIndex < allMissions.length - 1

        return (
          <div style={{ marginBottom: 36 }}>
            <div>
              <h2
                style={{
                  fontFamily: "'Gowun Dodum', sans-serif",
                  fontSize: 19,
                  color: "#2A1F14",
                  margin: "0 0 4px",
                }}
              >
                추가 미션
              </h2>
              <p style={{ fontSize: 12, color: "#7A6B58", margin: "0 0 14px" }}>
                단계를 완료하면 새로운 미션이 열려요
              </p>
            </div>
            <CarouselArrows
              color={color}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onPrev={() => setCurrentStageIndex((i) => Math.max(0, i - 1))}
              onNext={() => setCurrentStageIndex((i) => Math.min(allMissions.length - 1, i + 1))}
            >
              <StepSection
                title={`단계 ${currentMission.stage}`}
                missions={currentMission.missions}
                color={color}
                bg={bg}
                mascotEmoji={mascotEmoji}
                unlocked={currentMission.unlocked}
                progress={currentMission.unlocked ? `${currentMission.completedCount} / 4 완료` : "🔒 이전 단계를 먼저 완료해 주세요"}
                onSelect={setSelected}
              />
            </CarouselArrows>
          </div>
        )
      })()}

      {selected && (
        <MissionModal
          mission={selected}
          color={color}
          bg={bg}
          mascotEmoji={mascotEmoji}
          petImageUrl={dashboard.petImageUrl}
          onClose={() => setSelected(null)}
          onComplete={handleComplete}
        />
      )}
    </div>
  )
}
