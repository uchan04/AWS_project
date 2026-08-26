/**
 * 낙관적 갱신 단정. `npm run check:optimistic`
 *
 * 왜 스크립트로 남기는가 — 되돌리기가 있는 상태 변경은 눈으로 못 본다.
 * 실패 경로(서버가 거절 → applyCompletion(false))는 화면에서 재현하기 어렵고,
 * 여기서 깨지면 사용자에게는 "카운터가 -1이 됐다"로 나타난다.
 */
import assert from "node:assert/strict"
import { applyCompletion } from "../lib/missions/optimistic"
import type { DashboardDTO } from "../lib/missions/dashboard"

function reward() {
  return { seeds: 10, starShards: 0, affinity: 2 }
}

function mission(id: string, completed: boolean) {
  return {
    id,
    code: `CODE_${id}`,
    title: id,
    description: "",
    requiresPhoto: false,
    completionMode: "BUTTON" as const,
    completed,
    reward: reward(),
  }
}

function fixture(): DashboardDTO {
  return {
    dailyMissions: [mission("d1", false), mission("d2", true)],
    stageMissions: [
      {
        stage: 1,
        unlocked: true,
        completedCount: 1,
        requiredForNextStage: 3,
        bandLabel: "집 안에서",
        missions: [mission("s1", true), mission("s2", false), mission("s3", false)],
      },
      {
        stage: 2,
        unlocked: false,
        completedCount: 0,
        requiredForNextStage: 3,
        bandLabel: "집 밖으로",
        missions: [mission("s4", false)],
      },
    ],
    progress: { dailyCompleted: 1, dailyTotal: 2, weeklyCompleted: 5, weeklyTotal: 14, streak: 3 },
    attendance: {
      cycleDay: 3,
      claimedToday: true,
      attendanceTotal: 10,
      todayKey: "2026-08-24",
      month: "2026-08",
      claimedDates: ["2026-08-22", "2026-08-23", "2026-08-24"],
    },
    stages: { current: 1, total: 100, graduated: false },
    // 전에는 "INDEPENDENT_LOW_INCOME_A"였다. `_A` 접미사가 붙은 코드는 스키마에
    // 없다(TypeCode 3개 · SubTypeCode 8개 어디에도) — DTO 타입이 `string`이라
    // 컴파일이 통과했던 것이다. DTO를 TypeCode로 좁혀서 이제 잡힌다
    userTypeCode: "INDEPENDENT_LOW_INCOME",
    petImageUrl: null,
    avatarUrl: null,
  }
}

// 1. 일일 미션 완료 — 그 미션만 바뀌고 카운터가 하나씩 오른다
{
  const after = applyCompletion(fixture(), "d1", true)
  assert.equal(after.dailyMissions.find((m) => m.id === "d1")!.completed, true)
  assert.equal(after.dailyMissions.find((m) => m.id === "d2")!.completed, true)
  assert.equal(after.progress.dailyCompleted, 2)
  assert.equal(after.progress.weeklyCompleted, 6)
}

// 2. 되돌리기 — 원래 값으로 정확히 돌아온다
{
  const base = fixture()
  const rolledBack = applyCompletion(applyCompletion(base, "d1", true), "d1", false)
  assert.deepEqual(rolledBack, base)
}

// 3. 되돌리기가 두 번 들어와도 카운터가 음수로 가지 않는다
//    (요청 실패 + 사용자가 다시 눌러 또 실패하는 경우)
{
  const twice = applyCompletion(applyCompletion(fixture(), "d2", false), "d2", false)
  assert.equal(twice.progress.dailyCompleted, 0)
  assert.equal(twice.progress.weeklyCompleted, 4)
}

// 4. 이미 그 상태면 원본을 그대로 돌려준다(리렌더도 없다)
{
  const base = fixture()
  assert.equal(applyCompletion(base, "d2", true), base)
  assert.equal(applyCompletion(base, "s1", true), base)
}

// 5. 카운터가 총계를 넘지 않는다
{
  const base = fixture()
  const full = applyCompletion(applyCompletion(base, "d1", true), "d1", true)
  assert.equal(full.progress.dailyCompleted, 2)
  assert.ok(full.progress.dailyCompleted <= full.progress.dailyTotal)
}

// 6. 단계 미션 — 그 단계의 completedCount만 오르고 다른 단계는 그대로다
{
  const after = applyCompletion(fixture(), "s2", true)
  const st1 = after.stageMissions.find((s) => s.stage === 1)!
  const st2 = after.stageMissions.find((s) => s.stage === 2)!
  assert.equal(st1.completedCount, 2)
  assert.equal(st1.missions.find((m) => m.id === "s2")!.completed, true)
  assert.equal(st2.completedCount, 0)
  // 단계 미션은 일일 카운터를 건드리지 않는다
  assert.equal(after.progress.dailyCompleted, 1)
}

// 7. 해금은 여기서 계산하지 않는다 — computeStageProgress()의 몫이고,
//    두 벌로 구현하면 갈라진다. 재조회가 도착할 때 반영된다
{
  let dto = fixture()
  for (const id of ["s2", "s3"]) dto = applyCompletion(dto, id, true)
  const st1 = dto.stageMissions.find((s) => s.stage === 1)!
  assert.equal(st1.completedCount, 3)
  assert.equal(st1.completedCount >= st1.requiredForNextStage, true)
  assert.equal(dto.stageMissions.find((s) => s.stage === 2)!.unlocked, false, "해금은 서버가 준다")
  assert.equal(dto.stages.current, 1, "stages.current도 서버가 준다")
}

// 8. 없는 id는 원본을 그대로 돌려준다(모달이 닫히는 중 눌린 경우)
{
  const base = fixture()
  assert.equal(applyCompletion(base, "없는미션", true), base)
}

// 9. 원본을 변형하지 않는다 — 되돌리기가 원본 참조에 의존한다
{
  const base = fixture()
  const snapshot = JSON.stringify(base)
  applyCompletion(base, "d1", true)
  applyCompletion(base, "s2", true)
  assert.equal(JSON.stringify(base), snapshot)
}

console.log("check:optimistic — 9건 통과")
