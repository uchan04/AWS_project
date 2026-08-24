/**
 * buildDashboard 변경 전후를 한 세션에서 번갈아 잰다.
 *   `npx tsx scripts/perf-dashboard-ab.ts [회차]`
 *
 * A = 변경 전. 6개 쿼리를 Promise.all(미션 카탈로그 2개를 요청마다 DB에서 읽는다).
 *     이 스크립트 안에 그대로 박아 둔다 — 되돌려 비교할 수 있게.
 * B = 변경 후. lib/missions/dashboard.ts의 buildDashboard(). 카탈로그는
 *     lib/missions/catalog.ts의 프로세스 내 캐시에서 온다.
 *
 * 왜 번갈아 재는가 — A를 다 재고 B를 다 재면 그 사이 링크 상태 변화가 그대로
 * 차이로 보인다. 회차마다 순서를 뒤집으면 그 편향이 상쇄된다.
 *
 * 왜 첫 회차를 따로 표시하는가 — B의 첫 요청은 캐시가 비어 A와 같은 일을 한다.
 * 캐시의 값은 2회차부터 나온다. 그걸 감추면 눈속임이 된다.
 *
 * 읽기 전용이다. 공유 개발 DB에 쓰지 않는다.
 */
import { PrismaClient, type Prisma } from "@prisma/client"
import { MISSIONS_PER_STAGE } from "../lib/missions/bands"
import { computeStageProgress, currentStageOf } from "../lib/missions/stages"
import { buildDashboard } from "../lib/missions/dashboard"

const prisma = new PrismaClient()
const RUNS = Number(process.argv[2] ?? 10)
const STAGE_WINDOW = 2

const stageWhere = (typeCode: string): Prisma.MissionWhereInput => ({
  scope: "STAGE",
  typeCode: typeCode as never,
  order: { lte: MISSIONS_PER_STAGE },
})

type Ctx = { userId: string; typeCode: string; today: string; mondayKey: string; todayDate: Date }

/** A: 변경 전 그대로. 미션 카탈로그 2개가 이 묶음 안에 있다 */
async function variantA(c: Ctx) {
  const [, dailyCompletions, allStageMissions, allStageCompletions] = await Promise.all([
    prisma.mission.findMany({ where: { scope: "DAILY" }, orderBy: { order: "asc" } }),
    prisma.userMission.findMany({
      where: { userId: c.userId, resetKey: c.today, mission: { scope: "DAILY" } },
      select: { missionId: true },
    }),
    prisma.mission.findMany({
      where: stageWhere(c.typeCode),
      orderBy: [{ stage: "asc" }, { order: "asc" }],
    }),
    prisma.userMission.findMany({
      where: { userId: c.userId, resetKey: "STAGE", mission: stageWhere(c.typeCode) },
      select: { missionId: true },
    }),
    prisma.userMission.count({
      where: {
        userId: c.userId,
        resetKey: { gte: c.mondayKey, lte: c.today },
        mission: { scope: "DAILY" },
      },
    }),
    prisma.attendanceClaim.count({ where: { userId: c.userId, claimDate: c.todayDate } }),
  ])
  const progress = computeStageProgress(
    allStageMissions,
    new Set(allStageCompletions.map((x) => x.missionId)),
  )
  const current = currentStageOf(progress)
  const windowRows = allStageMissions.filter(
    (m) => m.stage != null && Math.abs(m.stage - current) <= STAGE_WINDOW,
  ).length
  return {
    current,
    windowRows,
    daily: dailyCompletions.length,
    // DB에서 이 요청이 실제로 끌어온 미션 카탈로그 바이트
    catalogBytes: JSON.stringify(allStageMissions).length,
  }
}

function p50(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "test@welli.local" } })
  if (!user?.typeCode) {
    console.error("test@welli.local 이 없거나 진단 전이다")
    process.exit(1)
  }
  const c: Ctx = {
    userId: user.id,
    typeCode: user.typeCode,
    today: new Date().toLocaleDateString("sv-SE"),
    mondayKey: new Date(Date.now() - 6 * 86400000).toLocaleDateString("sv-SE"),
    todayDate: new Date(new Date().toLocaleDateString("sv-SE") + "T00:00:00.000Z"),
  }

  // 풀 예열. 동시로 내야 연결이 여러 개 열린다(순차면 1개만 열려 뒤 측정이 오염된다)
  await Promise.all(Array.from({ length: 8 }, (_, i) => prisma.$queryRaw`SELECT ${i}::int`))
  const t0 = performance.now()
  await prisma.$queryRaw`SELECT 1`
  const base = performance.now() - t0

  const aMs: number[] = []
  const bMs: number[] = []
  let aInfo!: Awaited<ReturnType<typeof variantA>>
  let bDto!: Awaited<ReturnType<typeof buildDashboard>>

  console.log(`\n왕복 1회 기준선 ${base.toFixed(0)}ms · ${RUNS}회 · 회차마다 순서를 뒤집는다`)
  console.log(`A = 변경 전(쿼리 6개)  B = 변경 후(쿼리 4개 + 카탈로그 캐시)\n`)
  console.log("회차     A(전)      B(후)     차이")
  console.log("─".repeat(48))

  for (let i = 0; i < RUNS; i++) {
    let ta: number, tb: number
    if (i % 2 === 0) {
      let t = performance.now()
      aInfo = await variantA(c)
      ta = performance.now() - t
      t = performance.now()
      bDto = await buildDashboard(user)
      tb = performance.now() - t
    } else {
      let t = performance.now()
      bDto = await buildDashboard(user)
      tb = performance.now() - t
      t = performance.now()
      aInfo = await variantA(c)
      ta = performance.now() - t
    }
    aMs.push(ta)
    bMs.push(tb)
    console.log(
      `${String(i + 1).padStart(3)}${i === 0 ? "*" : " "} ${ta.toFixed(0).padStart(7)}ms ${tb
        .toFixed(0)
        .padStart(9)}ms  ${(tb - ta > 0 ? "+" : "") + (tb - ta).toFixed(0)}ms`,
    )
  }
  console.log("  * 1회차는 B의 캐시가 비어 있다 — A와 같은 일을 한다")

  // 캐시 예열 후 정상 상태만 따로 본다. 실사용에서 대부분의 요청이 여기 해당한다
  const aWarm = aMs.slice(1)
  const bWarm = bMs.slice(1)
  const pa = p50(aWarm)
  const pb = p50(bWarm)

  console.log()
  console.log(`A 변경 전  p50 ${pa.toFixed(0).padStart(5)}ms  왕복 ${(pa / base).toFixed(1)}회  DB 쿼리 6개  카탈로그 ${(aInfo.catalogBytes / 1024).toFixed(1)}KB를 매번 읽음`)
  console.log(`B 변경 후  p50 ${pb.toFixed(0).padStart(5)}ms  왕복 ${(pb / base).toFixed(1)}회  DB 쿼리 4개  카탈로그 0KB (캐시)`)
  console.log(
    `\n벽시계 ${pa > pb ? "감소" : "증가"} ${Math.abs(pa - pb).toFixed(0)}ms (${(
      ((pa - pb) / pa) *
      100
    ).toFixed(0)}%) · DB에서 읽는 미션 카탈로그 ${(aInfo.catalogBytes / 1024).toFixed(1)}KB -> 0KB`,
  )

  // 빨라도 답이 다르면 쓸 수 없다. 같은 DTO를 내는지 확인한다
  const bWindow = bDto.stageMissions.reduce((n, s) => n + s.missions.length, 0)
  const ok = aInfo.current === bDto.stages.current && aInfo.windowRows === bWindow
  console.log(
    `\n동등성: 현재 단계 A=${aInfo.current} B=${bDto.stages.current} · 창 안 미션 수 A=${aInfo.windowRows} B=${bWindow}` +
      ` · 일일 완료 A=${aInfo.daily} B=${bDto.progress.dailyCompleted} -> ${ok ? "일치" : "**불일치 — 되돌려라**"}`,
  )
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
