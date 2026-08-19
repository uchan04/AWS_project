"use client"

import { useState, useRef } from "react"
import "./mission-ui.module.css"

// ─── 임시 시각 데이터 (TODO: API 연결 시 제거) ────────────────────────────

const TEMP_PROFILE = {
  nickname: "조용한 여우",
  character: "fox" as const,
}

const TEMP_MISSIONS = [
  {
    id: "temp-daily-1",
    title: "커튼 열고 햇빛 보기",
    emoji: "🌤️",
    description: "창문 커튼을 열고 1분만 바깥을 바라봐요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 10, starShards: 0, affinity: 0 },
  },
  {
    id: "temp-daily-2",
    title: "물 한 잔 마시기",
    emoji: "💧",
    description: "지금 물 한 잔을 마셔요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 10, starShards: 0, affinity: 0 },
  },
  {
    id: "temp-stage-1",
    title: "창문 열고 환기하기",
    emoji: "🌬️",
    description: "창문을 열어 5분만 공기를 바꿔봐요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 20, starShards: 0, affinity: 0 },
  },
  {
    id: "temp-stage-2",
    title: "그릇 하나 씻기",
    emoji: "🍽️",
    description: "쌓인 그릇 중 하나만 씻어봐요.",
    requiresPhoto: false,
    completed: false,
    reward: { seeds: 20, starShards: 0, affinity: 0 },
  },
]

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

// ─── 애니메이션 매핑 ────────────────────────────────────────────────────────

const ANIM_MAP: Record<string, string> = {
  walk: "mascotWalk",
  stretch: "mascotStretch",
  drink: "mascotDrink",
  eat: "mascotEat",
  rest: "mascotRest",
  look: "mascotLook",
  write: "mascotWrite",
  music: "mascotMusic",
  photo: "mascotPhoto",
  default: "float",
}

const ANIM_DURATION: Record<string, string> = {
  rest: "2.4s",
  look: "2.4s",
  default: "3s",
  eat: "0.9s",
  music: "1s",
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

type TempMission = (typeof TEMP_MISSIONS)[number]

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
  const animName = ANIM_MAP[animType] ?? "float"
  const animDur = ANIM_DURATION[animType] ?? "1.4s"
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
            style={{
              fontSize: 120,
              lineHeight: 1,
              display: "inline-block",
              animation: `${animName} ${animDur} ease-in-out infinite`,
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

// ─── Main dashboard ─────────────────────────────────────────────────────────

export default function MissionDashboard() {
  const [selected, setSelected] = useState<TempMission | null>(null)

  const profile = TEMP_PROFILE
  const color = CHARACTER_COLOR[profile.character]
  const bg = CHARACTER_BG[profile.character]
  const mascotEmoji = CHARACTER_EMOJI[profile.character]

  return (
    <>
      <div className="screen-enter" style={{ flex: 1, overflow: "hidden auto", padding: "32px 40px 56px" }}>
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
          <p style={{ color: "#7A6B58", fontSize: 14, margin: 0 }}>
            {profile.nickname}님, 오늘도 작은 걸음을 함께 걸어요.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
          }}
        >
          {TEMP_MISSIONS.map((mission) => (
            <button
              key={mission.id}
              onClick={() => setSelected(mission)}
              className="card-hover mission-slide-in"
              style={{
                background: mission.completed ? bg : "#FDFBF5",
                borderRadius: 18,
                padding: "24px",
                border: `1.5px solid ${mission.completed ? color + "55" : "#DDD0BC"}`,
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
              {mission.completed && <div style={{ marginTop: 8, fontSize: 12, color, fontWeight: 700 }}>완료 ✓</div>}
            </button>
          ))}
        </div>
      </div>

      {selected && <MissionModal mission={selected} color={color} bg={bg} mascotEmoji={mascotEmoji} onClose={() => setSelected(null)} />}
    </>
  )
}
