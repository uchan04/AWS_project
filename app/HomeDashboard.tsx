"use client"

// 소유자: A. 진단을 마친 사람이 보는 홈. 진단 전 화면은 app/_components/Intro.tsx다.
//
// 종족·닉네임은 서버(page.tsx)가 props로 준다 — 전에는 이 화면이 /api/diagnosis/me를
// 직접 불러서, 이미 서버가 쿠키를 읽어 알고 있는 값을 왕복 한 번 더 들여 다시 읽었다.
// 미션만 클라이언트에서 읽는다(진행률·오늘 목록).
//
// 미션 문구를 홈에 복사하거나 시드 배열을 직접 읽지 않는다 — 원본은 DB다(결정 10번).
//
// 스타일은 design.md가 정한다. Hallmark · macrostructure: Index-First.
// 홈은 링크 목록이다. 화면을 채우는 가운데 정렬 히어로를 두지 않는다.

import Link from "next/link"
import { useEffect, useState } from "react"
import type { TypeCode } from "@prisma/client"
import { REDIAGNOSIS_ENABLED } from "@/lib/diagnosis/flags"
import { TRIBE } from "@/lib/types"

// GET /api/missions(B 소유)가 돌려주는 DashboardDTO 중 홈이 쓰는 부분만 적는다.
// lib/missions/dashboard.ts의 타입을 import하면 홈이 서버 모듈에 묶인다
type DailyMissionView = { code: string; title: string; completed: boolean; reward: { seeds: number } }
type ProgressView = {
  dailyCompleted: number
  dailyTotal: number
  weeklyCompleted: number
  weeklyTotal: number
  streak: number
}
type MissionsView = { dailyMissions: DailyMissionView[]; progress: ProgressView }

// 달성률 0~100. 분모가 0이면 0으로 둔다 — 미션이 아직 시드되지 않은 DB에서 NaN이 되면
// style의 width가 통째로 무효가 되고 aria-valuenow도 깨진다
function ratioOf(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((done / total) * 100))
}

// 시간대 인사. 서버 렌더 시각과 브라우저 시각이 다를 수 있으므로 마운트 후에만 계산한다
function greetingFor(hour: number): string {
  if (hour < 12) return "좋은 아침이에요"
  if (hour < 18) return "오늘 하루도"
  return "오늘도 수고했어요"
}

export default function HomeDashboard({
  nickname,
  typeCode,
}: {
  nickname: string
  typeCode: TypeCode
}) {
  const [greeting, setGreeting] = useState("")
  // undefined = 아직 읽는 중, null = 못 읽었다(에러).
  // 둘을 같은 값으로 두면 fetch가 끝나기 전에 실패 문구가 먼저 뜬다(2026-08-22 실측 버그).
  const [missions, setMissions] = useState<MissionsView | null | undefined>(undefined)

  useEffect(() => {
    let alive = true

    // 인사말도 이 콜백 안에서 정한다. 이펙트 본문에서 바로 setState하면
    // react-hooks/set-state-in-effect가 에러다. 성공·실패 양쪽에서 세팅해야
    // 미션을 못 읽었을 때 인사말까지 사라지지 않는다
    function settle(next: MissionsView | null) {
      if (!alive) return
      setGreeting(greetingFor(new Date().getHours()))
      setMissions(next)
    }

    fetch("/api/missions")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const data = body?.data
        settle(data?.dailyMissions && data?.progress ? (data as MissionsView) : null)
      })
      .catch(() => settle(null))

    return () => {
      alive = false
    }
  }, [])

  const tribe = TRIBE[typeCode]

  return (
    <main className="hm" data-tribe={typeCode}>
      <div className="hm__col hm-home">
        {/* 인사말·이름은 왼쪽, 마스코트는 오른쪽. Figma 홈 헤더 구성이다 */}
        <div className="hm-home__head">
          <div className="hm-home__who">
            <p className="hm__note">{greeting}</p>
            <h1 className="hm-home__name">{nickname}</h1>
            <span className="hm-pill">
              <span aria-hidden="true">{tribe.emoji}</span> {tribe.family}
            </span>
          </div>
          {/* 펫 이미지는 S3 업로드 전이다. 지금은 이모지 마스코트가 자리를 잡는다 */}
          <span className="hm-home__mascot hm-float" aria-hidden="true">
            {tribe.emoji}
          </span>
        </div>

        {/* 진행 카드. 값은 GET /api/missions의 progress 그대로다 — 홈에서 다시 계산하지 않는다.
            순위·비교는 넣지 않는다(SPEC 5절, 경쟁 지표 의도적 배제) */}
        {missions && (
          <div className="hm-card">
            <div className="hm-card__head">
              {/* 제목이 길면 375px에서 두 줄로 접히고 옆의 배지가 밀린다. .hm-card__head는
                  다른 카드도 쓰는 공유 클래스라 CSS 대신 문구를 짧게 잡았다 */}
              <h2 className="hm-card__title">오늘의 나</h2>
              <span className="hm-pill">
                <span aria-hidden="true">🔥</span>{" "}
                {missions.progress.streak > 0 ? `연속 ${missions.progress.streak}일` : "오늘부터"}
              </span>
            </div>

            <div className="hm-status">
              <span className="hm__note">오늘</span>
              <span className="hm__note">
                {missions.progress.dailyCompleted}/{missions.progress.dailyTotal}
              </span>
            </div>
            <div
              className="hm-bar"
              role="progressbar"
              aria-label="오늘 미션 달성률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ratioOf(missions.progress.dailyCompleted, missions.progress.dailyTotal)}
            >
              <div
                className="hm-bar__fill"
                style={{
                  width: `${ratioOf(missions.progress.dailyCompleted, missions.progress.dailyTotal)}%`,
                }}
              />
            </div>

            <div className="hm-status">
              <span className="hm__note">이번 주</span>
              <span className="hm__note">
                {missions.progress.weeklyCompleted}/{missions.progress.weeklyTotal}
              </span>
            </div>
            <div
              className="hm-bar"
              role="progressbar"
              aria-label="이번 주 미션 달성률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ratioOf(missions.progress.weeklyCompleted, missions.progress.weeklyTotal)}
            >
              <div
                className="hm-bar__fill"
                style={{
                  width: `${ratioOf(missions.progress.weeklyCompleted, missions.progress.weeklyTotal)}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="hm-home__cards">
          {/* 펫 카드. 레벨·경험치는 /pet에서 보여준다 — 홈에 같은 숫자를 두 번 두지 않는다 */}
          <div className="hm-card hm-card--tribe">
            <div className="hm-card__head">
              <h2 className="hm-card__title">키우기</h2>
              <span className="hm__note">{tribe.colorName}</span>
            </div>
            <p className="hm__note">씨앗을 모아 함께 자라요.</p>
            <Link href="/pet" className="hm-btn hm-card__cta">
              펫 보러 가기
            </Link>
          </div>

          {/* 오늘의 미션 미리보기. GET /api/missions에서 읽는다. 완료한 것도 그대로 보여준다 —
              홈에서 목록이 줄어들면 무엇을 했는지가 안 보인다 */}
          <div className="hm-card">
            <div className="hm-card__head">
              <h2 className="hm-card__title">오늘의 미션</h2>
              <Link href="/missions" className="hm-link">
                전체 보기
              </Link>
            </div>
            {missions === undefined ? (
              <p className="hm__note" role="status" aria-live="polite">
                오늘 미션을 불러오고 있어요…
              </p>
            ) : missions === null ? (
              <p className="hm__note" role="alert">
                미션을 불러오지 못했어요. 전체 보기에서 확인해 주세요
              </p>
            ) : (
              <div className="hm-tiles">
                {missions.dailyMissions.slice(0, 4).map((mission) => (
                  <div key={mission.code} className="hm-tile">
                    <span className="hm-tile__title">
                      {mission.completed ? "✓ " : ""}
                      {mission.title}
                    </span>
                    <span className="hm-tile__hint">
                      {mission.completed ? "완료했어요" : `씨앗 ${mission.reward.seeds}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Link href="/community" className="hm-row">
          <span>
            <span className="hm-row__label">커뮤니티</span>
            <span className="hm-row__hint">한 줄만 남겨도 충분해요</span>
          </span>
          <span className="hm-row__mark" aria-hidden="true">
            →
          </span>
        </Link>

        {/* 재진단은 잠겨 있다(lib/diagnosis/flags.ts). 플래그를 켜면 이 링크가 돌아온다 */}
        {REDIAGNOSIS_ENABLED && (
          <div className="hm-home__foot">
            <hr className="hm__rule" />
            <Link href="/diagnosis" className="hm-link">
              다시 진단하기
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
