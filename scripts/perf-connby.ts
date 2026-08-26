/**
 * 커넥션을 **누가** 쥐고 있는지 본다. `npx tsx scripts/perf-connby.ts`
 *
 * perf-conncheck.ts는 총량만 준다. 상한에 부딪혔을 때 필요한 것은 총량이 아니라
 * 어느 기기·어느 프로세스가 몇 개를 쥐고 있는지다 — 그게 "끌 대상"을 정한다.
 *
 * 커넥션이 고갈된 상태에서도 물어봐야 하는 스크립트라 풀을 1로 못 박는다.
 * DATABASE_URL은 비밀번호를 담으므로 출력하지 않는다.
 *
 * 읽기 전용이다.
 */
import { PrismaClient } from "@prisma/client"

const raw = process.env.DATABASE_URL
if (!raw) throw new Error("DATABASE_URL이 없다")
const url = raw.includes("connection_limit=")
  ? raw
  : `${raw}${raw.includes("?") ? "&" : "?"}connection_limit=1`

const prisma = new PrismaClient({ datasources: { db: { url } } })

type Row = {
  client_addr: string | null
  usename: string | null
  app: string | null
  total: number
  idle: number
  active: number
  oldest_min: number | null
}

async function main() {
  const [sum] = await prisma.$queryRaw<Array<{ max_conn: number; reserved: number; used: number }>>`
    SELECT
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')                AS max_conn,
      (SELECT setting::int FROM pg_settings WHERE name = 'superuser_reserved_connections') AS reserved,
      (SELECT count(*)::int FROM pg_stat_activity)                                         AS used
  `
  const usable = sum.max_conn - sum.reserved
  console.log(`app share ${usable}  used ${sum.used}  free ${usable - sum.used}`)
  console.log("")

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      host(client_addr)                                                    AS client_addr,
      usename                                                              AS usename,
      coalesce(nullif(application_name, ''), '-')                          AS app,
      count(*)::int                                                        AS total,
      count(*) FILTER (WHERE state = 'idle')::int                          AS idle,
      count(*) FILTER (WHERE state = 'active')::int                        AS active,
      round(max(extract(epoch FROM now() - backend_start)) / 60)::int      AS oldest_min
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
    GROUP BY 1, 2, 3
    ORDER BY total DESC
  `
  console.log("conns  idle  active  oldest      client / user / app")
  for (const r of rows) {
    const n = String(r.total).padStart(5)
    const i = String(r.idle).padStart(5)
    const a = String(r.active).padStart(7)
    const o = `${r.oldest_min ?? 0}m`.padStart(8)
    console.log(`${n}${i}${a}${o}      ${r.client_addr ?? "local"} / ${r.usename ?? "-"} / ${r.app}`)
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
