/**
 * 쓰기 경로(미션 완료 · 좋아요)를 단계별로 쪼갠다. `npx tsx scripts/perf-write-path.ts`
 *
 * 왜 필요한가 — 읽기 경로는 perf-ttfb.sh로 잡았지만 쓰기 경로가 훨씬 느렸다.
 * 실측: POST /api/missions/:id/complete = 1466ms(왕복 8.1회), 좋아요 = 1281ms(왕복 7.1회).
 * 읽기 화면 376ms의 4배다. 그런데 어느 단계가 몇 회를 쓰는지는 라우트를 봐서는 모른다 —
 * 트랜잭션 안의 `await` 하나하나가 각각 왕복 1회이기 때문이다.
 *
 * 왜 이미 완료한 미션으로 재는가 — `userMission.create`가 P2002로 되돌아가므로
 * **공유 개발 DB의 데이터가 바뀌지 않는다.** 왕복 구조는 성공 경로와 같다
 * (성공 경로는 ROLLBACK 대신 user.update + COMMIT이라 오히려 더 많다).
 *
 * 트랜잭션은 왕복을 이렇게 쓴다:
 *   BEGIN(1) + 문장마다 1 + COMMIT 또는 ROLLBACK(1)
 * 그래서 트랜잭션 안에서 `await`를 하나 줄이면 정확히 180ms가 빠진다.
 */
import { prisma } from "../lib/prisma"
import { loadCompletableMission, completeMission } from "../lib/missions/completion"
import { getStageProgress } from "../lib/missions/stages"

const RUNS = Number(process.argv[2] ?? 5)

function p50(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "test@welli.local" },
    include: { activePetSkin: true },
  })
  if (!user?.typeCode) {
    console.error("test@welli.local 이 없거나 진단 전이다")
    process.exit(1)
  }

  // 이미 완료한 단계 미션을 고른다. 없으면 이 스크립트는 DB를 바꾸게 되므로 중단한다
  const done = await prisma.userMission.findFirst({
    where: { userId: user.id, resetKey: "STAGE" },
    include: { mission: true },
  })
  if (!done) {
    console.error("완료한 단계 미션이 없다 — 이 스크립트는 DB를 바꾸지 않으려고 여기서 멈춘다")
    process.exit(1)
  }
  const missionId = done.missionId

  // 풀·prepare 예열. 이걸 안 하면 1회차가 전부를 왜곡한다(perf-prepare.ts 참고)
  for (let i = 0; i < 3; i++) {
    await loadCompletableMission(user.id, user.typeCode, missionId)
    await completeMission({ actor: user, missionId, resetKey: "STAGE" })
  }

  // 기준선도 예열한다. SELECT 1의 첫 실행은 자기 prepare 왕복까지 재서 2배로 나온다
  await prisma.$queryRaw`SELECT 1`
  const t0 = performance.now()
  await prisma.$queryRaw`SELECT 1`
  const base = performance.now() - t0

  const steps: Record<string, number[]> = {
    "mission.findUnique (loadCompletable 안)": [],
    "getStageProgress (해금 확인)": [],
    "loadCompletableMission 전체": [],
    "completeMission — 행을 다시 읽음(전)": [],
    "completeMission — 행을 넘겨받음(후)": [],
    "합계 (라우트 본문, 후)": [],
  }

  for (let i = 0; i < RUNS; i++) {
    let t = performance.now()
    await prisma.mission.findUnique({ where: { id: missionId } })
    steps["mission.findUnique (loadCompletable 안)"].push(performance.now() - t)

    t = performance.now()
    await getStageProgress(user.id, user.typeCode)
    steps["getStageProgress (해금 확인)"].push(performance.now() - t)

    // 전: mission을 넘기지 않으면 completeMission이 같은 행을 다시 읽는다
    t = performance.now()
    await completeMission({ actor: user, missionId, resetKey: "STAGE" })
    steps["completeMission — 행을 다시 읽음(전)"].push(performance.now() - t)

    // 후: 라우트가 실제로 하는 것 — 검증에서 받은 행을 그대로 넘긴다
    const tAll = performance.now()
    t = performance.now()
    const loaded = await loadCompletableMission(user.id, user.typeCode, missionId)
    steps["loadCompletableMission 전체"].push(performance.now() - t)
    if (loaded.error) {
      console.error("loadCompletableMission이 거절했다 — 미션 선택이 잘못됐다")
      process.exit(1)
    }

    t = performance.now()
    await completeMission({ actor: user, missionId, resetKey: "STAGE", mission: loaded.mission })
    steps["completeMission — 행을 넘겨받음(후)"].push(performance.now() - t)
    steps["합계 (라우트 본문, 후)"].push(performance.now() - tAll)
  }

  console.log(`\n왕복 1회 기준선 ${base.toFixed(0)}ms · ${RUNS}회 · 미션 ${done.mission.title}`)
  console.log(`(이미 완료한 미션이라 P2002로 되돌아간다 — DB는 바뀌지 않는다)\n`)
  console.log("단계                                       p50      왕복")
  console.log("─".repeat(60))
  for (const [name, xs] of Object.entries(steps)) {
    const v = p50(xs)
    console.log(`${name.padEnd(42)}${v.toFixed(0).padStart(5)}ms  ${(v / base).toFixed(1)}회`)
  }
  console.log(
    "\n참고: getCurrentUserWithSkin()이 라우트 첫 줄에 왕복 2회를 더 쓴다(스킨 있는 사용자).",
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
