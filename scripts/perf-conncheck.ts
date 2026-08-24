/**
 * 공유 개발 DB의 연결 상한과 현재 사용량. `npx tsx scripts/perf-conncheck.ts`
 *
 * 연결 풀 예열(instrumentation.ts)이 몇 개를 열어도 되는지 정하려면 상한을 알아야 한다.
 * 5인이 각자 로컬 서버를 띄우는 프로젝트라 인스턴스당 열 개수 × 사람 수가 상한에
 * 부딪히면 팀원 쪽에서 "연결 거부"로 터진다. 예열 개수를 못 박기 전에 확인한다.
 *
 * 읽기 전용이다.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{
      max_conn: number
      reserved: number
      in_use_all: number
      in_use_this_db: number
      idle: number
    }>
  >`
    SELECT
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')                  AS max_conn,
      (SELECT setting::int FROM pg_settings WHERE name = 'superuser_reserved_connections')   AS reserved,
      (SELECT count(*)::int FROM pg_stat_activity)                                           AS in_use_all,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database())        AS in_use_this_db,
      (SELECT count(*)::int FROM pg_stat_activity
        WHERE datname = current_database() AND state = 'idle')                               AS idle
  `
  const r = rows[0]
  const usable = r.max_conn - r.reserved
  console.log(`max_connections          : ${r.max_conn}`)
  console.log(`superuser 예약            : ${r.reserved}`)
  console.log(`앱이 쓸 수 있는 상한      : ${usable}`)
  console.log(`지금 열린 연결(전체)      : ${r.in_use_all}`)
  console.log(`지금 열린 연결(이 DB)     : ${r.in_use_this_db}  (idle ${r.idle})`)
  console.log(`남은 여유                 : ${usable - r.in_use_all}`)

  // 클라이언트별로 몇 개씩 물고 있는지 — 누가 많이 쓰는지 본다
  const byApp = await prisma.$queryRaw<Array<{ client: string; n: number }>>`
    SELECT coalesce(host(client_addr)::text, 'local') AS client, count(*)::int AS n
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY 1 ORDER BY n DESC
  `
  console.log(`\n클라이언트별:`)
  for (const b of byApp) console.log(`  ${String(b.n).padStart(3)}개  ${b.client}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
