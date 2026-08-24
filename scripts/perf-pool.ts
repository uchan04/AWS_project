/**
 * 병렬 쿼리가 왜 왕복 1회로 끝나지 않는지 가른다. `npx tsx scripts/perf-pool.ts`
 *
 * perf-probe.ts에서 개별 쿼리는 176ms(왕복 1회)인데 6개를 Promise.all로 내면
 * 725ms(왕복 4.1회)가 나왔다. 원인 후보가 셋이고 서로 처방이 다르다:
 *
 *   (A) 연결 풀이 지연 생성이라 첫 병렬 묶음이 TLS 핸드셰이크 5회를 낸다
 *       -> 처방: 부팅 시 풀 예열. 두 번째 묶음부터 빨라져야 한다
 *   (B) Prisma가 실제로는 직렬화한다
 *       -> 처방: 쿼리 수 자체를 줄인다. 예열해도 안 빨라진다
 *   (C) RDS·네트워크가 동시 요청에서 느려진다
 *       -> 처방: 없음(인프라). 순차와 병렬의 차이가 없어야 한다
 *
 * 읽기 전용이다. 공유 개발 DB에 쓰지 않는다.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const N = 6

async function one(i: number) {
  // 어느 쿼리든 왕복 1회면 되는 것으로 고정한다. 쿼리 모양 차이를 변수에서 뺀다.
  // pg_sleep()은 void를 돌려줘 Prisma가 역직렬화하지 못한다 — 스칼라만 고른다
  return prisma.$queryRaw`SELECT ${i}::int AS n`
}

async function sequential() {
  const t0 = performance.now()
  for (let i = 0; i < N; i++) await one(i)
  return performance.now() - t0
}

async function parallel() {
  const t0 = performance.now()
  await Promise.all(Array.from({ length: N }, (_, i) => one(i)))
  return performance.now() - t0
}

async function main() {
  // 연결 1개만 열린 상태를 만든다
  await prisma.$queryRaw`SELECT 1`
  const t0 = performance.now()
  await prisma.$queryRaw`SELECT 1`
  const base = performance.now() - t0
  console.log(`\n왕복 1회 기준선: ${base.toFixed(0)}ms  (동시 ${N}개로 실험)\n`)

  console.log("회차   순차     병렬   병렬/기준선   해석")
  console.log("─".repeat(64))
  for (let round = 1; round <= 4; round++) {
    const s = await sequential()
    const p = await parallel()
    const ratio = p / base
    // 예열이 원인이면 1회차만 크고 2회차부터 1.0x에 붙는다
    const note = ratio < 1.6 ? "왕복 1회분 — 병렬 성립" : ratio > N * 0.7 ? "거의 직렬" : "부분 병렬"
    console.log(
      `${String(round).padStart(3)}  ${s.toFixed(0).padStart(5)}ms  ${p
        .toFixed(0)
        .padStart(5)}ms   ${(ratio.toFixed(1) + "x").padStart(6)}       ${note}`,
    )
  }

  // 풀에 실제로 몇 개가 열렸는지 DB 쪽에서 확인한다
  const conns = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::bigint AS n FROM pg_stat_activity
    WHERE datname = current_database() AND application_name <> 'psql'
  `
  console.log(`\n이 DB에 열려 있는 연결 수(전체 클라이언트 합): ${conns[0].n}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
