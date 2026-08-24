/**
 * 연결 수(connection_limit)가 병렬 묶음의 벽시계를 바꾸는지 잰다.
 *   `npx tsx scripts/perf-limit.ts [회차]`
 *
 * 확정된 사실 사슬:
 *   1. 링크 완벽. $queryRaw SELECT 1 = 177ms, 40/40 왕복 1회 (perf-rtt.ts)
 *   2. ORM 쿼리는 SQL 1문. N+1 없음 (perf-sqlcount.ts)
 *   3. ORM 쿼리를 **순차로** 반복하면 1회차 362ms(왕복 2회) → 이후 180ms(왕복 1회) 고정.
 *      connection_limit 1·5·25 모두 동일 (perf-prepare.ts)
 *   4. 그런데 **병렬** 6개 묶음은 예열 후에도 ~540ms(왕복 3회)에 머문다.
 *      그 안의 engine duration이 179 / 352 / 353 / 354 / 358 / 717ms로 **혼재**한다.
 *
 * 3과 4를 합치면 설명이 하나로 좁혀진다: prepared statement 캐시는 **연결마다** 따로다.
 * 순차 실행은 같은 연결을 재사용하니 두 번째부터 적중한다. 병렬 6개는 서로 다른 연결
 * 6개에 흩어지고, 풀에 연결이 25개면 (문 6개 × 연결 25개 = 준비 150회)를 다 채우기 전까지
 * 매 요청이 미스를 섞어 맞는다. 저트래픽 앱에서는 그 예열이 끝나지 않는다.
 *
 * 그러면 연결 수를 줄이면 예열해야 할 조합이 줄어 벽시계가 왕복 1회로 수렴해야 한다.
 * 이 스크립트가 그것을 확인한다. 맞으면 처방은 앱 코드가 아니라 connection_limit이다.
 *
 * 읽기 전용이다.
 */
import { PrismaClient } from "@prisma/client"
import { MISSIONS_PER_STAGE } from "../lib/missions/bands"

const ROUNDS = Number(process.argv[2] ?? 10)

function url(limit: number | null) {
  const base = process.env.DATABASE_URL
  if (!base) throw new Error("DATABASE_URL 없음")
  if (limit == null) return base
  return base + (base.includes("?") ? "&" : "?") + `connection_limit=${limit}`
}

async function measure(label: string, limit: number | null) {
  const prisma = limit == null ? new PrismaClient() : new PrismaClient({ datasourceUrl: url(limit) })
  const user = await prisma.user.findFirst({ where: { email: "test@welli.local" } })
  if (!user?.typeCode) throw new Error("test@welli.local 이 없거나 진단 전이다")
  const typeCode = user.typeCode
  const today = new Date().toLocaleDateString("sv-SE")

  const batch = () =>
    Promise.all([
      prisma.mission.findMany({ where: { scope: "DAILY" }, orderBy: { order: "asc" } }),
      prisma.userMission.findMany({
        where: { userId: user.id, resetKey: today, mission: { scope: "DAILY" } },
        select: { missionId: true },
      }),
      prisma.mission.findMany({
        where: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
        orderBy: [{ stage: "asc" }, { order: "asc" }],
      }),
      prisma.userMission.findMany({
        where: {
          userId: user.id,
          resetKey: "STAGE",
          mission: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
        },
        select: { missionId: true },
      }),
      prisma.userMission.count({
        where: { userId: user.id, resetKey: { lte: today }, mission: { scope: "DAILY" } },
      }),
      prisma.attendanceClaim.count({ where: { userId: user.id } }),
    ])

  const ms: number[] = []
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now()
    await batch()
    ms.push(performance.now() - t)
  }
  await prisma.$disconnect()

  const s = [...ms].sort((a, b) => a - b)
  const p50 = s[Math.floor(s.length / 2)]
  const tail = s.slice(Math.max(0, s.length - 3))
  console.log(
    `${label.padEnd(22)} ${ms.map((x) => x.toFixed(0).padStart(4)).join(" ")}` +
      `\n${" ".repeat(22)} p50 ${p50.toFixed(0)}ms · 마지막3 ${tail.map((x) => x.toFixed(0)).join("/")}ms`,
  )
  return p50
}

async function main() {
  console.log(`\nbuildDashboard의 6개 병렬 묶음을 ${ROUNDS}회 연속. connection_limit별 비교`)
  console.log(`왕복 1회 ≈ 180ms. 왕복 1회로 수렴하면 ~180ms, 안 하면 360ms 이상\n`)

  const r: Array<[string, number]> = []
  for (const lim of [null, 10, 5, 2, 1] as const) {
    const label = lim == null ? "기본(미지정=25)" : `connection_limit=${lim}`
    r.push([label, await measure(label, lim)])
    console.log()
  }

  console.log("─".repeat(70))
  const best = r.reduce((a, b) => (b[1] < a[1] ? b : a))
  for (const [label, p50] of r) {
    console.log(
      `${label.padEnd(22)} p50 ${p50.toFixed(0).padStart(5)}ms  왕복 ${(p50 / 180).toFixed(1)}회${
        label === best[0] ? "   ← 최소" : ""
      }`,
    )
  }
  const baseP50 = r[0][1]
  console.log(
    `\n기본 대비 최소값: ${(baseP50 - best[1]).toFixed(0)}ms 감소 (${(
      ((baseP50 - best[1]) / baseP50) *
      100
    ).toFixed(0)}%) — ${best[0]}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
