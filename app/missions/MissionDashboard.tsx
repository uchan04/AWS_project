"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import styles from "./mission-ui.module.css"

// ─── 임시 시각 데이터 ─────────────────────────────────────────────────────
// UI 비교 전용. Figma 원본 스크린샷과 동일한 고양이 미션 사용.
// 3단계에서 GET /api/missions 응답으로 완전 교체 예정.
// localStorage, 클라이언트 보상·해금 계산 금지.

const TEMP_PROFILE = {
  nickname: "고요한 고양이",
  character: "cat" as const,
}

type TempMission = {
  id: string
  step: number
  title: string
  emoji: string
  description: string
  requiresPhoto: boolean
  completed: boolean
  reward: { seeds: number; starShards: number; affinity: number }
}

const TEMP_MISSIONS: TempMission[] = [
  {
    id: "c1_1",
    step: 1,
    title: "좋아하는 장소 간단히 그려보기",
    emoji: "🎨",
    description: "잘 그리지 않아도 괜찮아요. 내 마음속 좋아하는 장소를 대충이라도 그려봐요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 20, starShards: 0, affinity: 0 },
  },
  {
    id: "c1_2",
    step: 1,
    title: "오늘 느낌 이모지 3개로 표현",
    emoji: "😊",
    description: "오늘 하루를 이모지 3개로만 표현해봐요. 설명 없이 이모지만으로도 충분해요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 20, starShards: 0, affinity: 0 },
  },
  {
    id: "c1_3",
    step: 1,
    title: "10분 동안 완전히 쉬기",
    emoji: "😴",
    description: "핸드폰도, 생각도 잠깐 내려두고 10분 동안 그냥 있어봐요. 아무것도 안 해도 돼요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 20, starShards: 0, affinity: 0 },
  },
  {
    id: "c1_4",
    step: 1,
    title: "좋아하는 동물 영상 보기",
    emoji: "🐾",
    description: "귀여운 동물 영상을 5분만 봐요. 그게 전부예요. 충분해요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 20, starShards: 0, affinity: 0 },
  },
  {
    id: "c2_1",
    step: 2,
    title: "좋아하는 책/만화 10페이지 읽기",
    emoji: "📚",
    description: "부담 없이 좋아하는 것 10페이지만 읽어봐요. 멈추고 싶으면 멈춰도 돼요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 35, starShards: 0, affinity: 0 },
  },
  {
    id: "c2_2",
    step: 2,
    title: "내 공간 작은 것 하나 바꿔보기",
    emoji: "🏠",
    description: "꽃 한 송이, 인형 위치 바꾸기, 포스터 하나. 아주 작은 변화면 충분해요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 35, starShards: 0, affinity: 0 },
  },
  {
    id: "c2_3",
    step: 2,
    title: "새로운 음악 장르 5분 탐험",
    emoji: "🎼",
    description: "평소와 다른 장르의 음악을 5분만 들어봐요. 마음에 안 들어도 괜찮아요.",
    requiresPhoto: true,
    completed: false,
    reward: { seeds: 35, starShards: 0, affinity: 0 },
  },
  {
    id: "c2_4",
    step: 2,
    title: "오늘 잘한 점 하나 찾기",
    emoji: "⭐",
    description: '"숨만 쉬었다"도 괜찮아요. 오늘 내가 한 것 중 잘한 점 하나를 찾아봐요.',
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 35, starShards: 0, affinity: 0 },
  },
]

const TEMP_STEPS = [
  { step: 1, unlocked: true, completedCount: 0, unlockNeeded: 0 },
  { step: 2, unlocked: false, completedCount: 0, unlockNeeded: 3 },
]

const DISPLAY_COUNT = 4

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

function getMissionAnimType(mission: { title: string; emoji: string }): string {
  const t = mission.title + mission.emoji
  if (/산책|걷|나가/.test(t)) return "walk"
  if (/스트레칭|🤸|🙆/.test(t)) return "stretch"
  if (/마시|음료|물|차|코코아|💧|🍵|☕/.test(t)) return "drink"
  if (/먹|간식|음식|밥|🍜|🍪|🍽/.test(t)) return "eat"
  if (/쉬|누|자|낮잠|담요|이불|😴|💤|🧸/.test(t)) return "rest"
  if (/하늘|창문|햇빛|바깥|환기|창가|🪟|🌤|☀/.test(t)) return "look"
  if (/쓰|메모|일기|편지|기록|📝|💌|📖/.test(t)) return "write"
  if (/음악|노래|플레이리스트|🎵|🎶|🎼|🎧/.test(t)) return "music"
  if (/그|사진|📸|🎨|📷/.test(t)) return "photo"
  return "default"
}

// ─── Mission modal ──────────────────────────────────────────────────────────

interface MissionModalProps {
  mission: TempMission
  color: string
  bg: string
  mascotEmoji: string
  onClose: () => void
}

function MissionModal({ mission, color, bg, mascotEmoji, onClose }: MissionModalProps) {
  const [proofMode, setProofMode] = useState(false)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const animType = getMissionAnimType(mission)
  const animClass = ANIM_CLASS[animType] ?? styles.mascotFloat
  const caption = ANIM_CAPTION[animType] ?? ANIM_CAPTION.default

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setProofImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleComplete() {
    // TODO: API 연결 시 POST /api/missions/{missionId}/complete 또는 upload/verify
    onClose()
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
            className={animClass}
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
            <div style={{ fontSize: 28, marginBottom: 6 }}>{mission.emoji}</div>
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

        <div style={{ padding: "24px 32px 32px" }}>
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
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleFile}
                      />
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
                            background: "#F5F0E8",
                            border: "2px dashed #DDD0BC",
                            borderRadius: 14,
                            padding: "24px",
                            fontSize: 13,
                            color: "#9A8A76",
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                          사진을 올려 미션 완료를 인증해요
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleComplete}
                style={{
                  width: "100%",
                  background: color,
                  color: "white",
                  border: "none",
                  borderRadius: 14,
                  padding: "15px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans KR', sans-serif",
                  boxShadow: `0 4px 16px ${color}44`,
                }}
              >
                완료했어요 ✓
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step section (Figma 원본 기반) ────────────────────────────────────────

interface StepSectionProps {
  step: number
  missions: TempMission[]
  unlocked: boolean
  unlockNeeded: number
  completedIds: string[]
  color: string
  bg: string
  onSelect: (m: TempMission) => void
}

function StepSection({ step, missions, unlocked, unlockNeeded, completedIds, color, bg, onSelect }: StepSectionProps) {
  const initQueue = useCallback(() => {
    const undone = missions.filter((m) => !completedIds.includes(m.id)).map((m) => m.id)
    const done = missions.filter((m) => completedIds.includes(m.id)).map((m) => m.id)
    return [...undone, ...done].slice(0, DISPLAY_COUNT)
  }, [missions, completedIds])

  const [displayIds, setDisplayIds] = useState<string[]>(initQueue)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  const prevCompleted = useRef(new Set(completedIds))

  useEffect(() => {
    const newlyDone = completedIds.filter((id) => !prevCompleted.current.has(id))
    prevCompleted.current = new Set(completedIds)

    newlyDone.forEach((id) => {
      if (!displayIds.includes(id)) return
      if (exitingIds.has(id)) return

      setExitingIds((prev) => new Set([...prev, id]))

      setTimeout(() => {
        setExitingIds((prev) => {
          const s = new Set(prev)
          s.delete(id)
          return s
        })
        setDisplayIds((prev) => {
          const shown = new Set(prev)
          const next = missions.find((m) => !completedIds.includes(m.id) && !shown.has(m.id))
          if (!next) return prev
          return prev.map((p) => (p === id ? next.id : p))
        })
      }, 300)
    })
  }, [completedIds, missions, displayIds, exitingIds])

  const stepDone = missions.filter((m) => completedIds.includes(m.id)).length

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: unlocked ? color : "#DDD0BC",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {step}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 17, color: unlocked ? "#2A1F14" : "#9A8A76" }}>
            {step === 1 ? "첫 걸음" : step === 2 ? "한 걸음 더" : `${step}단계`}
          </span>
          {!unlocked && (
            <span style={{ marginLeft: 10, fontSize: 12, color: "#9A8A76" }}>
              🔒 이전 단계 {unlockNeeded}개 완료 시 해제
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 13,
            color: "#9A8A76",
            background: "#F0EAD8",
            padding: "4px 12px",
            borderRadius: 99,
          }}
        >
          {stepDone}/{missions.length} 완료
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
          opacity: unlocked ? 1 : 0.4,
          pointerEvents: unlocked ? "auto" : "none",
        }}
      >
        {displayIds.map((id) => {
          const mission = missions.find((m) => m.id === id)
          if (!mission) return null
          const done = completedIds.includes(id)
          const exiting = exitingIds.has(id)
          return (
            <button
              key={id}
              onClick={() => onSelect(mission)}
              className={`card-hover ${exiting ? styles.missionSlideOut : styles.missionSlideIn}`}
              style={{
                background: done ? bg : "#FDFBF5",
                borderRadius: 18,
                padding: "24px",
                border: `1.5px solid ${done ? color + "55" : "#DDD0BC"}`,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>{mission.emoji}</div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 14,
                  color: "#2A1F14",
                  lineHeight: 1.5,
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                {mission.title}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    color: "#9A8A76",
                    background: "#F0EAD8",
                    padding: "3px 8px",
                    borderRadius: 99,
                  }}
                >
                  🌱 +{mission.reward.seeds}
                </span>
              </div>
              {done && <div style={{ marginTop: 8, fontSize: 12, color, fontWeight: 700 }}>완료 ✓</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main dashboard ─────────────────────────────────────────────────────────

export default function MissionDashboard() {
  const [selected, setSelected] = useState<TempMission | null>(null)

  const profile = TEMP_PROFILE
  const color = CHARACTER_COLOR[profile.character]
  const bg = CHARACTER_BG[profile.character]
  const mascotEmoji = CHARACTER_EMOJI[profile.character]

  const completedIds: string[] = [] // TODO: 3단계에서 서버 응답으로 교체

  return (
    <>
      <div className="screen-enter" style={{ flex: 1, overflow: "hidden auto", padding: "32px 40px 56px", background: "#F5F0E8", position: "relative" }}>
        {/* 하트 버튼 (Figma 원본 챗봇 버튼 위치) */}
        <button
          style={{
            position: "absolute",
            top: 20,
            right: 24,
            zIndex: 100,
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#FDFBF5",
            border: "2px solid #DDD0BC",
            cursor: "pointer",
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            transition: "all 0.2s",
          }}
          aria-label="마음 친구"
        >
          🤍
        </button>

        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: "'Gowun Dodum', sans-serif",
              fontSize: 28,
              color: "#2A1F14",
              margin: "0 0 6px",
            }}
          >
            {mascotEmoji} 오늘의 미션
          </h1>
          <p style={{ color: "#9A8A76", fontSize: 14, margin: 0 }}>작은 한 걸음이 큰 변화를 만들어요. 할 수 있는 것부터 천천히.</p>
        </div>

        {TEMP_STEPS.map((stepInfo) => {
          const stepMissions = TEMP_MISSIONS.filter((m) => m.step === stepInfo.step)
          return (
            <StepSection
              key={stepInfo.step}
              step={stepInfo.step}
              missions={stepMissions}
              unlocked={stepInfo.unlocked}
              unlockNeeded={stepInfo.unlockNeeded}
              completedIds={completedIds}
              color={color}
              bg={bg}
              onSelect={setSelected}
            />
          )
        })}
      </div>

      {selected && <MissionModal mission={selected} color={color} bg={bg} mascotEmoji={mascotEmoji} onClose={() => setSelected(null)} />}
    </>
  )
}
