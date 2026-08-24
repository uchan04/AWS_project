import type { DashboardDTO } from "./dashboard"

/**
 * 낙관적 갱신 — 서버 응답을 기다리지 않고 대시보드 DTO에 완료 표시를 먼저 반영한다.
 *
 * 왜 필요한가. `POST /api/missions/:id/complete`는 왕복 7회(1253ms 실측,
 * `scripts/perf-write-path.ts`)이고 그 뒤 대시보드 재조회가 왕복 2회(370ms)다.
 * RDS가 us-east-1이라 이 1.6초는 코드로 줄일 수 있는 몫이 얼마 남지 않았다 —
 * 트랜잭션의 BEGIN·COMMIT까지 각각 왕복 1회이고 그건 보상 지급의 원자성 자체다.
 * 그래서 **줄이는 대신 기다리지 않게** 한다. 체크는 즉시 뜨고, 서버 응답이 오면
 * 진짜 값으로 맞추고, 실패하면 되돌린다.
 *
 * 순수 함수로 뺀 이유 — 되돌리기가 있는 상태 변경은 화면 코드에 인라인으로 두면
 * 검증할 수 없다. `npm run check:optimistic`이 이 파일만 단정한다.
 *
 * 여기서 **하지 않는 것**: 단계 해금(`unlocked`)과 `stages.current` 재계산.
 * 그건 `computeStageProgress()`의 일이고 클라이언트에서 다시 구현하면 두 벌이 갈라진다.
 * 해금은 재조회가 도착할 때(370ms 뒤) 반영된다.
 */
export function applyCompletion(
  dto: DashboardDTO,
  missionId: string,
  completed: boolean,
): DashboardDTO {
  const daily = dto.dailyMissions.find((m) => m.id === missionId)

  if (daily) {
    // 이미 그 상태면 그대로 둔다. 안 그러면 되돌리기가 두 번 들어올 때 카운트가 음수로 간다
    if (daily.completed === completed) return dto
    const delta = completed ? 1 : -1
    return {
      ...dto,
      dailyMissions: dto.dailyMissions.map((m) => (m.id === missionId ? { ...m, completed } : m)),
      progress: {
        ...dto.progress,
        dailyCompleted: clamp(dto.progress.dailyCompleted + delta, 0, dto.progress.dailyTotal),
        weeklyCompleted: clamp(dto.progress.weeklyCompleted + delta, 0, dto.progress.weeklyTotal),
      },
    }
  }

  const stage = dto.stageMissions.find((s) => s.missions.some((m) => m.id === missionId))
  if (!stage) return dto

  const target = stage.missions.find((m) => m.id === missionId)!
  if (target.completed === completed) return dto
  const delta = completed ? 1 : -1

  return {
    ...dto,
    stageMissions: dto.stageMissions.map((s) =>
      s.stage === stage.stage
        ? {
            ...s,
            completedCount: clamp(s.completedCount + delta, 0, s.missions.length),
            missions: s.missions.map((m) => (m.id === missionId ? { ...m, completed } : m)),
          }
        : s,
    ),
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}
