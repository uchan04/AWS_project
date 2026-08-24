/**
 * ORM 쿼리 하나가 왜 왕복 2회인지 가른다. `npx tsx scripts/perf-prepare.ts`
 *
 * 지금까지 확정된 사실:
 *   · 링크 완벽. $queryRaw SELECT 1 = 177ms 왕복 1회, 40/40 (perf-rtt.ts)
 *   · 풀 정상. raw 6개 동시는 1회차만 9.2배, 이후 12회 1.0배 고정 (perf-converge.ts)
 *   · ORM 쿼리는 SQL 정확히 1문. N+1도 관계 필터 펼침도 없다 (perf-sqlcount.ts)
 *   · 그런데 ORM 쿼리 하나의 engine duration이 **360ms = 왕복 2회**다
 *
 * 남은 후보 둘. 처방이 정반대다:
 *   (P) prepared statement 준비 왕복. Postgres 확장 프로토콜에서 처음 보는 문은
 *       Parse/Describe와 Bind/Execute가 각각 왕복을 쓴다. 캐시는 **연결마다** 따로다.
 *       -> 같은 문을 같은 연결로 반복하면 180ms로 떨어져 고정돼야 한다.
 *          연결이 많으면 요청이 매번 다른 연결에 붙어 캐시 미스가 계속 난다.
 *       -> 처방: 연결 수를 줄인다(connection_limit). 앱 코드는 그대로.
 *   (Q) ORM 경로 자체가 원래 두 왕복이다.
 *       -> 반복해도 360ms에 고정된다. 처방: 쿼리 수를 줄이는 것밖에 없다.
 *
 * 세 클라이언트로 같은 문을 20회씩 돌려 가른다.
 * 읽기 전용이다.
 */
import { PrismaClient } from "@prisma/client"

const N = 20

function url(extra: string) {
  const base = process.env.DATABASE_URL
  if (!base) throw new Error("DATABASE_URL 없음")
  return base + (base.includes("?") ? "&" : "?") + extra
}

async function run(label: string, client: PrismaClient) {
  // 풀 예열 — 연결 수립 비용을 측정에서 뺀다
  await Promise.all(Array.from({ length: 4 }, (_, i) => client.$queryRaw`SELECT ${i}::int`))

  const ms: number[] = []
  for (let i = 0; i < N; i++) {
    const t = performance.now()
    await client.mission.findMany({ where: { scope: "DAILY" }, orderBy: { order: "asc" } })
    ms.push(performance.now() - t)
  }
  const s = [...ms].sort((a, b) => a - b)
  const p50 = s[Math.floor(s.length / 2)]
  const one = s[0]
  const twoPlus = ms.filter((x) => x > one * 1.6).length
  console.log(
    `\n${label}\n  ${ms.map((x) => x.toFixed(0)).join(" ")}` +
      `\n  min ${one.toFixed(0)}ms  p50 ${p50.toFixed(0)}ms  max ${s[s.length - 1].toFixed(0)}ms  ` +
      `왕복 2회 이상 표본 ${twoPlus}/${N}`,
  )
  await client.$disconnect()
  return { p50, one, twoPlus }
}

async function main() {
  console.log(`같은 ORM 쿼리(mission.findMany DAILY)를 ${N}회 반복. 클라이언트별 비교`)

  // 기본값. connection_limit 미지정 = num_cpus*2+1 = 25
  const a = await run("① 기본 (connection_limit 미지정 → 25)", new PrismaClient())

  // 연결 1개. 모든 쿼리가 같은 연결에 붙으므로 prepared 캐시가 100% 맞는다
  const b = await run(
    "② connection_limit=1 (모든 쿼리가 같은 연결 → prepared 캐시 항상 적중)",
    new PrismaClient({ datasourceUrl: url("connection_limit=1") }),
  )

  // 실서비스에 쓸 만한 중간값
  const c = await run(
    "③ connection_limit=5",
    new PrismaClient({ datasourceUrl: url("connection_limit=5") }),
  )

  console.log(`\n${"─".repeat(70)}`)
  console.log(`①  limit 25   p50 ${a.p50.toFixed(0)}ms   왕복2회+ ${a.twoPlus}/${N}`)
  console.log(`②  limit 1    p50 ${b.p50.toFixed(0)}ms   왕복2회+ ${b.twoPlus}/${N}`)
  console.log(`③  limit 5    p50 ${c.p50.toFixed(0)}ms   왕복2회+ ${c.twoPlus}/${N}`)
  console.log(
    `\n판정: ${
      b.p50 < a.p50 * 0.75
        ? "**(P) prepared statement 준비 왕복이다. 연결 수를 줄이면 빨라진다**"
        : "(Q) ORM 경로가 원래 두 왕복이다. 연결 수와 무관 — 쿼리 수를 줄이는 것뿐"
    }`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
