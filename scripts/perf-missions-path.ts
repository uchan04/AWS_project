/**
 * /missions 서버 경로를 단계별로 쪼개 잰다. `npx tsx scripts/perf-missions-path.ts`
 *
 * 웜 상태에서 /missions는 p50 743ms인데, 왕복 1회가 178ms이므로 왕복 4회분이다.
 * 그런데 buildDashboard()는 6개 쿼리를 Promise.all로 내므로 왕복 1회여야 하고
 * (scripts/perf-pool.ts에서 예열 후 181ms로 확인), getCurrentUser()가 1회다.
 * 합쳐 2회 = 375ms가 나와야 하는데 2회분이 더 있다. 어디인지 추측하지 않고 잰다.
 *
 * 읽기 전용이다. ensureMissionReset()은 쓰기를 하므로 **호출하지 않고**, 같은
 * 판단만 그대로 재현해 쓰기가 일어날 조건인지 확인한다.
 */
import { PrismaClient } from "@prisma/client"
import { buildDashboard } from "../lib/missions/dashboard"
import { getToday, getTodayKey } from "../lib/missions/reset"

const prisma = new PrismaClient()
const RUNS = Number(process.argv[2] ?? 5)

function t() {
  return performance.now()
}
function report(label: string, ms: number[], base: number) {
  const s = [...ms].sort((a, b) => a - b)
  const p50 = s[Math.floor(s.length / 2)]
  console.log(
    `${p50.toFixed(0).padStart(6)}ms  ${(p50 / base).toFixed(1).padStart(4)}x  ${label}`,
  )
  return p50
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "test@welli.local" } })
  if (!user?.typeCode) {
    console.error("test@welli.local 이 없거나 진단 전이다")
    process.exit(1)
  }

  // 풀 예열. 이 스크립트는 정상 상태를 재는 것이므로 연결 생성 비용을 빼야 한다
  await Promise.all(Array.from({ length: 8 }, (_, i) => prisma.$queryRaw`SELECT ${i}::int`))

  const b: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = t()
    await prisma.$queryRaw`SELECT 1`
    b.push(t() - t0)
  }
  const base = [...b].sort((x, y) => x - y)[Math.floor(b.length / 2)]
  console.log(`\n왕복 1회 기준선 ${base.toFixed(0)}ms · 각 ${RUNS}회\n`)
  console.log("   p50   왕복   단계")
  console.log("  " + "─".repeat(62))

  // 1) getCurrentUser()가 내는 쿼리
  const g: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = t()
    await prisma.user.findUnique({ where: { id: user.id } })
    g.push(t() - t0)
  }
  report("getCurrentUser: user.findUnique", g, base)

  // 2) buildDashboard() 전체
  const d: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = t()
    await buildDashboard(user)
    d.push(t() - t0)
  }
  report("buildDashboard() 전체", d, base)

  // 3) ensureMissionReset()이 쓰기를 하는 조건인지 — 호출하지 않고 판정만 재현한다
  const today = getToday()
  const last = user.lastMissionResetAt
  const earlyOut = Boolean(last && last >= today)
  console.log()
  console.log(`getToday()            = ${today.toISOString()}`)
  console.log(`lastMissionResetAt    = ${last ? last.toISOString() : "(null)"}`)
  console.log(`getTodayKey()         = ${getTodayKey()}`)
  console.log(
    `ensureMissionReset()  = ${
      earlyOut ? "쓰기 없음(조기 반환) — 왕복 0회" : "**user.update 실행 — 왕복 1회 이상**"
    }`,
  )
  if (!earlyOut) {
    console.log(
      `  -> 요청마다 쓰기가 일어난다. lastStreakDate=${
        user.lastStreakDate ? user.lastStreakDate.toISOString() : "(null)"
      } streakCount=${user.streakCount} 이면 두 번째 update까지 날 수 있다`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
