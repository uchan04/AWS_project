/**
 * Prisma가 쿼리 하나마다 실제로 내는 SQL 문을 세고 찍는다.
 *   `npx tsx scripts/perf-sqlcount.ts`
 *
 * 왜 필요한가 — 여기까지 확정된 사실:
 *   · 링크는 완벽하다. SELECT 1 40/40 전부 177ms (perf-rtt.ts)
 *   · 풀도 정상이다. raw 6개 동시 묶음은 1회차만 9.2배, 이후 12회 연속 1.0배 (perf-converge.ts)
 *   · 그런데 buildDashboard의 ORM 쿼리 6개를 Promise.all로 내면 예열 후에도 ~540ms,
 *     즉 왕복 3회다. 페이로드를 79% 줄여도 그대로다 (perf-dashboard-ab.ts)
 *
 * 남은 후보는 하나다: ORM 쿼리 하나가 SQL 문 여러 개로 펼쳐져 순차로 나간다.
 * 4개가 관계 필터(`mission: { scope: ... }`)를 쓰므로 거기가 의심 지점이다.
 * 세면 끝난다 — 추측할 일이 아니다.
 *
 * 로그 이벤트로 실제 SQL을 받아 쿼리별로 센다. 이 클라이언트는 계측 전용이고
 * lib/prisma.ts는 건드리지 않는다. 읽기 전용이다.
 */
import { PrismaClient } from "@prisma/client"
import { MISSIONS_PER_STAGE } from "../lib/missions/bands"

const prisma = new PrismaClient({ log: [{ emit: "event", level: "query" }] })

let captured: Array<{ sql: string; ms: number }> = []
prisma.$on("query", (e) => {
  captured.push({ sql: e.query, ms: e.duration })
})

async function count(label: string, fn: () => Promise<unknown>) {
  captured = []
  const t = performance.now()
  await fn()
  const wall = performance.now() - t
  // BEGIN/COMMIT는 트랜잭션 왕복이라 따로 표시한다
  const tx = captured.filter((c) => /^(BEGIN|COMMIT|ROLLBACK|DEALLOCATE)/i.test(c.sql.trim())).length
  const real = captured.length - tx
  console.log(
    `\n${label}\n  벽시계 ${wall.toFixed(0)}ms · SQL ${captured.length}문 (실쿼리 ${real} + 트랜잭션 ${tx})`,
  )
  for (const c of captured) {
    const one = c.sql.replace(/\s+/g, " ").trim()
    console.log(`    ${String(c.ms).padStart(4)}ms  ${one.slice(0, 150)}${one.length > 150 ? " …" : ""}`)
  }
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "test@welli.local" } })
  if (!user?.typeCode) {
    console.error("test@welli.local 이 없거나 진단 전이다")
    process.exit(1)
  }
  const typeCode = user.typeCode
  const today = new Date().toLocaleDateString("sv-SE")

  await Promise.all(Array.from({ length: 8 }, (_, i) => prisma.$queryRaw`SELECT ${i}::int`))

  await count("① 관계 필터 없음: mission.findMany({ scope: DAILY })", () =>
    prisma.mission.findMany({ where: { scope: "DAILY" }, orderBy: { order: "asc" } }),
  )

  await count("② 관계 필터 있음: userMission.findMany({ mission: { scope: DAILY } })", () =>
    prisma.userMission.findMany({
      where: { userId: user.id, resetKey: today, mission: { scope: "DAILY" } },
      select: { missionId: true },
    }),
  )

  await count("③ 관계 필터 + count: userMission.count({ mission: { scope: DAILY } })", () =>
    prisma.userMission.count({
      where: { userId: user.id, resetKey: { lte: today }, mission: { scope: "DAILY" } },
    }),
  )

  await count("④ 관계 필터(3조건): userMission.findMany({ mission: { scope, typeCode, order } })", () =>
    prisma.userMission.findMany({
      where: {
        userId: user.id,
        resetKey: "STAGE",
        mission: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
      },
      select: { missionId: true },
    }),
  )

  await count("⑤ buildDashboard의 6개 Promise.all 전체", () =>
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
    ]),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
