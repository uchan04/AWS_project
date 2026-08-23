"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import styles from "./mission-ui.module.css"
import { useModalA11y } from "@/app/components/useModalA11y"
import type { DashboardDTO, MissionDTO } from "@/lib/missions/dashboard"
import { applyCompletion } from "@/lib/missions/optimistic"

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

// 서버 기준과 같아야 한다 (lib/missions/upload.ts ALLOWED_TYPES·MAX_SIZE).
// 여기서 먼저 걸러야 3MB를 다 올린 뒤에 거절당하는 일이 없다
const PHOTO_TYPES = ["image/jpeg", "image/png"]
const PHOTO_MAX_BYTES = 3 * 1024 * 1024

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
  /** 사진 미션 완료 후 재조회. 사진 판정은 결과를 미리 알 수 없어 낙관적으로 처리할 수 없다 */
  onComplete: () => void
  /**
   * 버튼 미션 완료. 여기서 fetch하지 않고 부모에 넘긴다 —
   * 낙관적 갱신은 모달을 즉시 닫으므로, 요청이 이 컴포넌트보다 오래 살아야 한다
   */
  onButtonComplete: (mission: MissionDTO) => void
}

function MissionModal({
  mission,
  color,
  bg,
  mascotEmoji,
  onClose,
  onComplete,
  onButtonComplete,
}: MissionModalProps) {
  // Escape로 닫기 · 초점 가두기 · 닫을 때 초점 되돌리기 (app/components/useModalA11y.ts)
  const boxRef = useModalA11y(onClose)
  const [proofMode, setProofMode] = useState(false)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const animType = getMissionAnimType(mission)
  const caption = ANIM_CAPTION[animType] ?? ANIM_CAPTION.default
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

      // 서버(lib/missions/upload.ts)와 같은 기준으로 먼저 걸러 왕복을 아낀다
      if (!PHOTO_TYPES.includes(uploadedFile.type)) {
        setCompleteError("JPG 또는 PNG 사진만 올릴 수 있어요")
        return
      }
      if (uploadedFile.size > PHOTO_MAX_BYTES) {
        setCompleteError("사진 크기는 3MB 이하여야 해요")
        return
      }

      setCompleting(true)
      setCompleteError(null)

      try {
        // 1. presigned URL 받기.
        //
        // 2026-08-22: /api/missions/upload/* 대신 /api/upload/* 를 쓴다. 같은 일을 하는
        //   라우트가 두 벌 있었고 쓰던 쪽이 방어가 없었다 —
        //   fileKey 소유권 검사 없음(남의 사진 key로 내 미션을 통과시킬 수 있었다),
        //   용량·형식 검사 없음, 시스템 프롬프트 없음, passed 타입 검증 없음
        //   (모델이 문자열을 주면 truthy로 통과), 친밀도 일일 상한 우회.
        //   /api/upload/* 는 lib/missions/upload.ts + vision.ts + completion.ts 를 거쳐
        //   그 다섯 가지를 다 막는다. 단계 잠금 확인도 여기에만 있다
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missionId: mission.id,
            contentType: uploadedFile.type,
            fileSize: uploadedFile.size,
          }),
        })
        const presignJson = await presignRes.json()

        if (!presignRes.ok) {
          setCompleteError(presignJson.error?.message || "업로드 URL 생성 실패")
          return
        }

        const { uploadUrl, s3Key } = presignJson.data

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
        const verifyRes = await fetch("/api/upload/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ missionId: mission.id, s3Key }),
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

        // 통과했는데 새로 완료되지 않았으면 이미 받은 미션이다
        if (!verifyJson.data.completed) {
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

    // 버튼 미션은 여기서 기다리지 않는다. 부모가 체크를 먼저 그리고 요청을 뒤로 보낸다
    // (요청 자체는 왕복 7회 1253ms — scripts/perf-write-path.ts)
    onButtonComplete(mission)
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
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-modal-title"
        aria-describedby="mission-modal-desc"
        tabIndex={-1}
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
            type="button"
            onClick={onClose}
            aria-label="미션 창 닫기"
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
          {/* 2026-08-22: ANIM_CLASS가 정의만 돼 있고 어디에도 안 붙어 있었다.
              mission-ui.module.css의 미션별 동작 애니메이션 10종이 전부 죽어 있었고
              캡션("함께 걷고 있어요")만 떠서 문구와 화면이 어긋났다 */}
          <div
            className={ANIM_CLASS[animType] ?? ANIM_CLASS.default}
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
              id="mission-modal-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                color: "#2A1F14",
                margin: "0 0 10px",
              }}
            >
              {mission.title}
            </h2>
            <p id="mission-modal-desc" style={{ color: "#7A6B58", fontSize: 13, lineHeight: 1.8, margin: 0 }}>
              {mission.description}
            </p>
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
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png" style={{ display: "none" }} onChange={handleFile} />
                      {proofImage ? (
                        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "16/9" }}>
                          {/* FileReader가 만든 data: URL이다. next/image는 data URL을 최적화하지
                              못하고 unoptimized로 감싸면 <img>와 같아진다 */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={proofImage}
                            alt="올린 인증 사진 미리보기"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
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

              {/* role="alert"이 있어야 스크린리더가 실패 이유를 읽는다.
                  없으면 버튼만 다시 눌리고 왜 안 되는지 알 수 없다 */}
              {completeError && (
                <p
                  role="alert"
                  style={{ fontSize: 13, color: "#A9542A", marginBottom: 12, textAlign: "center" }}
                >
                  {completeError}
                </p>
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
                {/* completing은 사진 미션에서만 켜진다. 버튼 미션은 기다리지 않으므로 표시가 없다 */}
                {completing ? "검증 중..." : "완료했어요 ✓"}
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
              fontFamily: "var(--font-display)",
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
                  fontFamily: "var(--font-display)",
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

// ─── Daily focus card ──────────────────────────────────────────────────────
//
// 오늘 남은 일일 미션 중 **하나만** 크게 띄운다. 원안(develop의 DailyFocusSection)에서
// 바꾼 것:
// - 아래 목록에서 이 미션을 **뺀다.** 원안은 focus를 크게 띄우면서 목록에도 그대로
//   남겨 같은 미션이 화면에 두 번 나왔다
// - 이모지를 `title.includes("휴식")`으로 고르지 않는다. 이 파일에 이미
//   getEmojiForMission()이 있고, 제목 문자열에 기능을 걸면 문구를 다듬는 순간 깨진다
// - `mission.code === "DAILY_REST"` 특수 분기를 넣지 않는다. 특정 미션 코드를 화면이
//   알아야 하면 미션을 추가할 때마다 화면을 고쳐야 한다
//
// 왜 하나인가: 대상 이용자에게 할 일 5개를 한 번에 보여 주는 것은 목록이 아니라 압박이다.
// 5개가 다 보이는 그리드는 아래에 그대로 두되(선택권을 없애지 않는다), 시선의 기본값을
// 하나로 만든다. Finch·Streaks 같은 습관 앱이 같은 구조다.

interface DailyFocusCardProps {
  mission: MissionDTO
  color: string
  bg: string
  remaining: number
  onSelect: (m: MissionDTO) => void
}

function DailyFocusCard({ mission, color, bg, remaining, onSelect }: DailyFocusCardProps) {
  return (
    <button
      onClick={() => onSelect(mission)}
      className={styles.missionCard}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: bg,
        border: `2px solid ${color}`,
        borderRadius: 20,
        padding: "20px 22px",
        marginBottom: 14,
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color }}>오늘 이거 하나만</span>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
        <span style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">
          {getEmojiForMission(mission.title)}
        </span>
        <span style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              color: "#2A1F14",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {mission.title}
          </p>
          <p style={{ fontSize: 12, color: "#7A6B58", margin: "6px 0 0", display: "flex", gap: 8 }}>
            {mission.reward.seeds > 0 && <span>🌱 {mission.reward.seeds}</span>}
            {mission.reward.affinity > 0 && <span>💖 {mission.reward.affinity}</span>}
            {mission.reward.starShards > 0 && <span>⭐ {mission.reward.starShards}</span>}
          </p>
        </span>
      </div>
      {/* 남은 개수를 숨기지 않는다. 하나만 보여 주는 것과 나머지를 감추는 것은 다르다 —
          감추면 "다 했나?" 확인하러 새로고침하게 된다 */}
      <p style={{ fontSize: 11, color: "#7A6B58", margin: "12px 0 0" }}>
        {remaining > 0 ? `나머지 ${remaining}개는 아래에 있어요` : "오늘 남은 건 이거 하나예요"}
      </p>
    </button>
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
          fontFamily: "var(--font-display)",
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
        window.dispatchEvent(new CustomEvent("user-stats-changed"))
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
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          margin: "0 0 12px",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            color: "#2A1F14",
            margin: 0,
          }}
        >
          출석 캘린더
        </h3>
        {/* 격자는 이번 주기만 보여주므로 누적은 따로 적는다 — 안 적으면 7일마다
            성과가 0으로 리셋된 것처럼 보인다 */}
        <span style={{ fontSize: 12, color: "#7A6B58" }}>누적 {attendanceTotal}일</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          // 7일 주기 격자다. attendanceTotal >= day로 판정하면 8일차 이후로는
          // 7칸이 영구히 다 채워져서 주기가 사라진다 — 이번 주기 안에서만 본다
          const done = day < cycleDay || (day === cycleDay && claimedToday)
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
        <p style={{ fontSize: 13, color, textAlign: "center", margin: 0 }}>✓ 오늘 출석은 이미 받았어요</p>
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

/**
 * initial / initialError는 서버가 조립해 넘긴다(app/missions/page.tsx).
 * 둘 중 하나가 있으면 마운트 시 fetch를 하지 않는다 — 첫 화면이 이미 HTML에 들어 있다.
 * 둘 다 null인 경우는 남겨 둔다: 이 컴포넌트를 서버 데이터 없이 쓰는 곳이 생기면
 * 예전처럼 스스로 불러온다.
 */
export default function MissionDashboard({
  initial = null,
  initialError = null,
}: {
  initial?: DashboardDTO | null
  initialError?: string | null
} = {}) {
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(initial)
  const [loading, setLoading] = useState(!initial && !initialError)
  const [error, setError] = useState<string | null>(initialError)
  const [selected, setSelected] = useState<MissionDTO | null>(null)
  // 캐러셀 위치. null이면 "지금 서 있는 단계"를 보여준다(아래 defaultIndex).
  // 절대 인덱스를 state에 박아두면 미션을 완료해 창이 옮겨간 뒤 엉뚱한 단계를 가리킨다 —
  // 그래서 새로 불러올 때마다 null로 되돌린다
  const [stageIndexOverride, setStageIndexOverride] = useState<number | null>(null)
  // 낙관적 완료가 실패해 되돌렸을 때 띄운다. 모달의 에러 칸을 쓸 수 없다 —
  // 체크를 즉시 보여주려고 모달을 먼저 닫으므로 그 state가 함께 사라진다
  const [actionError, setActionError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    // 성공해도 error를 비우지 않으면 "다시 시도" 버튼이 아무 일도 하지 않는다.
    // 에러 화면 분기가 dashboard 분기보다 위에 있어서, 새로 받아온 데이터가 가려진다
    setError(null)
    try {
      const res = await fetch("/api/missions")
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || "미션을 불러올 수 없습니다")
        setLoading(false)
        return
      }
      setDashboard(json.data)
      setStageIndexOverride(null)
      setLoading(false)
    } catch {
      setError("네트워크 오류가 발생했습니다")
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 서버가 이미 넘겼으면 같은 것을 다시 부르지 않는다. 이 조건이 없으면 서버 렌더를
    // 해 두고도 마운트 직후 왕복 1회를 그대로 낸다 — 임계 경로에서 빠지지 않는다
    if (initial || initialError) return

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
  }, [initial, initialError])

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        {/* role="status"가 없으면 스크린리더에는 빈 화면이 뜬 것과 같다.
            aria-live="polite"라서 읽던 문장을 끊지 않고 뒤에 붙여 읽는다 */}
        <p role="status" aria-live="polite" style={{ fontSize: 15, color: "#7A6B58" }}>
          미션을 불러오는 중...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        {/* 실패는 즉시 알려야 하므로 status가 아니라 alert다 */}
        <p role="alert" style={{ fontSize: 15, color: "#A9542A", marginBottom: 20 }}>
          {error}
        </p>
        <button
          type="button"
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

  /**
   * 버튼 미션 완료 — 기다리지 않는다.
   *
   * 체크와 카운터를 먼저 그리고(applyCompletion) 요청을 보낸다. 실패하면 되돌리고 알린다.
   * 왜: POST가 왕복 7회(1253ms) + 재조회 2회(370ms)라 그대로 기다리면 탭 한 번에 1.6초를
   * 로딩 표시로 보낸다. RDS가 us-east-1이라 이 왕복은 코드로 더 줄일 몫이 거의 없다 —
   * 트랜잭션의 BEGIN·COMMIT이 보상 지급의 원자성 그 자체다.
   *
   * 재화는 낙관적으로 올리지 않는다. calculateReward()가 스킨 배율을 서버에서 걸어서
   * 클라이언트 추측이 틀릴 수 있다. 사이드바는 user-stats-changed로 응답 후에 맞춘다.
   */
  const handleButtonComplete = (mission: MissionDTO) => {
    setActionError(null)
    setSelected(null)
    setDashboard((prev) => (prev ? applyCompletion(prev, mission.id, true) : prev))

    void (async () => {
      try {
        const res = await fetch(`/api/missions/${mission.id}/complete`, { method: "POST" })
        const json = await res.json()
        if (!res.ok) {
          setDashboard((prev) => (prev ? applyCompletion(prev, mission.id, false) : prev))
          setActionError(json.error?.message || "완료 중 오류가 발생했습니다")
          return
        }
        window.dispatchEvent(new CustomEvent("user-stats-changed"))
        // 단계 해금·연속 달성처럼 서버만 아는 값을 맞춘다(applyCompletion은 일부러 건드리지 않는다)
        void loadDashboard()
      } catch {
        setDashboard((prev) => (prev ? applyCompletion(prev, mission.id, false) : prev))
        setActionError("네트워크 오류가 발생했습니다. 완료 표시를 되돌렸어요")
      }
    })()
  }

  return (
    <div style={{ padding: "32px 20px", maxWidth: 840, margin: "0 auto" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{mascotEmoji}</div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            color: "#2A1F14",
            margin: "0 0 8px",
          }}
        >
          오늘의 미션
        </h1>
        <p style={{ fontSize: 14, color: "#7A6B58", margin: 0 }}>작은 한 걸음씩, 함께 걸어가요</p>
      </header>

      {/* 낙관적 완료를 되돌렸을 때만 뜬다. 화면이 이미 바뀐 뒤라 즉시 알려야 하므로 alert */}
      {actionError && (
        <div
          role="alert"
          style={{
            background: "#FBEEE6",
            border: "1px solid #E8C4AE",
            borderRadius: 14,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 14, color: "#A9542A", flex: 1 }}>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="알림 닫기"
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              color: "#A9542A",
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
      )}

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

      {(() => {
        // 아직 안 한 일일 미션 중 첫 번째를 오늘의 하나로 잡는다. 서버가 이미
        // order로 정렬해 내려준다(lib/missions/dashboard.ts) — 여기서 다시 정렬하지 않는다.
        const undone = dashboard.dailyMissions.filter((m) => !m.completed)
        const focus = undone[0]
        // focus는 아래 목록에서 뺀다. 같은 미션이 두 번 나오면 두 번째 것을 눌러도
        // 같은 모달이 열려 사용자는 카드가 두 개인 이유를 찾게 된다
        const rest = focus ? dashboard.dailyMissions.filter((m) => m.id !== focus.id) : dashboard.dailyMissions

        return (
          <>
            {focus ? (
              <DailyFocusCard
                mission={focus}
                color={color}
                bg={bg}
                remaining={undone.length - 1}
                onSelect={setSelected}
              />
            ) : null}
            <StepSection
              title="일일 미션"
              subtitle={focus ? "나머지는 여기 있어요" : "오늘 다 했어요. 내일 또 만나요"}
              missions={rest}
              color={color}
              bg={bg}
              mascotEmoji={mascotEmoji}
              progress={`${dashboard.progress.dailyCompleted} / ${dashboard.progress.dailyTotal}`}
              onSelect={setSelected}
            />
          </>
        )
      })()}

      {(() => {
        // 모든 단계 표시 (잠김 포함)
        const allMissions = dashboard.stageMissions
        if (allMissions.length === 0) return null

        // 서버는 지금 단계 앞뒤 2칸만 보내준다(lib/missions/dashboard.ts STAGE_WINDOW).
        // 기본으로 보여줄 칸은 "지금 서 있는 단계"다 — 100단계 캐러셀을 1단계부터 열면
        // 37단계 사용자가 화살표를 36번 눌러야 한다
        const defaultIndex = Math.max(
          0,
          allMissions.findIndex((sm) => sm.stage === dashboard.stages.current),
        )
        const currentStageIndex = Math.min(
          allMissions.length - 1,
          stageIndexOverride ?? defaultIndex,
        )
        const currentMission = allMissions[currentStageIndex]
        const hasPrev = currentStageIndex > 0
        const hasNext = currentStageIndex < allMissions.length - 1

        return (
          <div style={{ marginBottom: 36 }}>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 19,
                    color: "#2A1F14",
                    margin: "0 0 4px",
                  }}
                >
                  단계 미션
                </h2>
                <span style={{ fontSize: 12, color: "#7A6B58" }}>
                  {dashboard.stages.current} / {dashboard.stages.total} 단계
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#7A6B58", margin: "0 0 14px" }}>
                {dashboard.stages.graduated
                  ? "100단계를 모두 지났어요. 여기까지 온 것 자체가 결과예요."
                  : "3개 중 2개를 하면 다음 단계가 열려요"}
              </p>
            </div>
            <div style={{ position: "relative" }}>
              {/* 왼쪽 화살표. ◀만 두면 스크린리더가 문자 이름을 읽거나 아무것도 읽지 않는다 */}
              <button
                type="button"
                aria-label="이전 단계 보기"
                onClick={() => setStageIndexOverride(Math.max(0, currentStageIndex - 1))}
                disabled={!hasPrev}
                style={{
                  position: "absolute",
                  left: -32,
                  top: "50%",
                  transform: "translateY(0%) scaleX(0.7)",
                  background: "transparent",
                  color: hasPrev ? color : "#DDD0BC",
                  border: "none",
                  cursor: hasPrev ? "pointer" : "not-allowed",
                  fontSize: 32,
                  zIndex: 10,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ◀
              </button>

              {/* 오른쪽 화살표 */}
              <button
                type="button"
                aria-label="다음 단계 보기"
                onClick={() => {
                  if (hasNext) {
                    setStageIndexOverride(Math.min(allMissions.length - 1, currentStageIndex + 1))
                  }
                }}
                disabled={!hasNext}
                style={{
                  position: "absolute",
                  right: -32,
                  top: "50%",
                  transform: "translateY(0%) scaleX(0.7)",
                  background: "transparent",
                  color: hasNext ? color : "#DDD0BC",
                  border: "none",
                  cursor: hasNext ? "pointer" : "not-allowed",
                  fontSize: 32,
                  zIndex: 10,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ▶
              </button>

              <StepSection
                title={`${currentMission.stage}단계 · ${currentMission.bandLabel}`}
                missions={currentMission.missions}
                color={color}
                bg={bg}
                mascotEmoji={mascotEmoji}
                unlocked={currentMission.unlocked}
                progress={
                  currentMission.unlocked
                    ? `${currentMission.completedCount} / ${currentMission.missions.length} 완료`
                    : `🔒 앞 단계에서 ${currentMission.requiredForNextStage}개를 먼저 해주세요`
                }
                onSelect={setSelected}
              />
            </div>
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
          onButtonComplete={handleButtonComplete}
        />
      )}
    </div>
  )
}
