/**
 * 같은 묶음을 연속으로 내면 수렴하는지 본다. `npx tsx scripts/perf-converge.ts [횟수]`
 *
 * 왜 필요한가 — perf-rtt.ts에서 단일 연결 순차 SELECT 1은 40/40 전부 177ms(왕복 1회)로
 * 링크가 완벽함을 확인했다. 그런데 perf-dashboard-ab.ts의 벽시계는 184 / 368 / 540 / 725ms를
 * 오갔다. 정확히 왕복 1·2·3·4배다. 그리고 그 값들은 페이로드를 79% 줄인 판에서도 똑같이
 * 나왔다. 즉 원인은 쿼리 내용이 아니라 **동시 실행 자체**다.
 *
 * 왕복 정수배는 연결 수립 비용의 모양이다(TCP 1회 + TLS 1~2회 + 쿼리 1회 = 3~4회).
 * 그렇다면 같은 묶음을 연속으로 내면 연결이 재사용되어 1회분으로 수렴해야 한다.
 * 수렴하면 병목은 buildDashboard가 아니라 연결 수립이고, 수렴하지 않으면 Prisma가
 * 매번 연결을 새로 만드는 것이다. 처방이 정반대여서 반드시 갈라야 한다.
 *
 * 매 회차 DB 쪽 연결 수를 함께 찍는다 — 늘기만 하면 풀이 새 연결을 계속 만든다는 증거다.
 *
 * 읽기 전용이다.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const N = Number(process.argv[2] ?? 12)
const CONCURRENCY = 6

async function conns() {
  const r = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::bigint AS n FROM pg_stat_activity
    WHERE datname = current_database() AND client_addr IS NOT NULL
  `
  return Number(r[0].n)
}

async function main() {
  await prisma.$queryRaw`SELECT 1`
  const t0 = performance.now()
  await prisma.$queryRaw`SELECT 1`
  const base = performance.now() - t0

  console.log(`\n왕복 1회 기준선 ${base.toFixed(0)}ms · 동시 ${CONCURRENCY}개 묶음을 ${N}회 연속\n`)
  console.log("회차     벽시계   왕복배수  DB연결수  해석")
  console.log("─".repeat(62))

  for (let i = 1; i <= N; i++) {
    const t = performance.now()
    await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, k) => prisma.$queryRaw`SELECT ${k}::int AS n`),
    )
    const ms = performance.now() - t
    const c = await conns() // 이 호출 자체는 측정 밖이다
    const mult = ms / base
    console.log(
      `${String(i).padStart(3)}  ${ms.toFixed(0).padStart(8)}ms  ${(mult.toFixed(1) + "x").padStart(7)}  ${String(c).padStart(7)}   ${
        mult < 1.4 ? "왕복 1회분 — 연결 재사용됨" : "연결 수립 비용이 섞였다"
      }`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
