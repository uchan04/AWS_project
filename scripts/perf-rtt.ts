/**
 * 왕복 1회의 분포를 본다. `npx tsx scripts/perf-rtt.ts [횟수]`
 *
 * 왜 필요한가 — perf-dashboard-ab.ts에서 벽시계가 184 / 368 / 540 / 725ms로
 * **왕복 182ms의 정수배에 양자화**돼 나왔다. 페이로드를 79% 줄인 판(B)과 안 줄인
 * 판(A)이 같은 값들을 오간다. 그러면 원인은 쿼리도 페이로드도 아니고, 링크 자체가
 * 요청마다 왕복 1~4회를 쓴다는 뜻이다. 그걸 확인하기 전에는 어떤 앱 코드 변경도
 * 개선인지 노이즈인지 구분할 수 없다.
 *
 * 이 스크립트는 가장 단순한 쿼리(SELECT 1) 하나만 반복한다. 여기서도 양자화가
 * 보이면 앱 코드에는 원인이 없다.
 *
 * 읽기 전용이다.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const N = Number(process.argv[2] ?? 40)

async function main() {
  await prisma.$queryRaw`SELECT 1` // 연결 수립을 측정에서 뺀다

  const ms: number[] = []
  for (let i = 0; i < N; i++) {
    const t = performance.now()
    await prisma.$queryRaw`SELECT 1`
    ms.push(performance.now() - t)
  }

  const s = [...ms].sort((a, b) => a - b)
  const min = s[0]
  const pick = (q: number) => s[Math.min(s.length - 1, Math.floor(s.length * q))]

  console.log(`\nSELECT 1 × ${N}회 (단일 연결, 순차)\n`)
  console.log(`min ${min.toFixed(0)}ms  p50 ${pick(0.5).toFixed(0)}ms  p90 ${pick(0.9).toFixed(0)}ms  max ${s[s.length - 1].toFixed(0)}ms`)
  console.log(`평균 ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(0)}ms`)

  // min을 왕복 1회로 보고 각 표본이 몇 배인지 센다. 정수배에 몰리면 양자화가 실재한다
  const buckets = new Map<number, number>()
  for (const x of ms) {
    const k = Math.round(x / min)
    buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  console.log(`\n왕복 배수 분포 (기준 min=${min.toFixed(0)}ms):`)
  for (const k of [...buckets.keys()].sort((a, b) => a - b)) {
    const n = buckets.get(k)!
    console.log(
      `  ${String(k).padStart(2)}배 (~${(k * min).toFixed(0)}ms)  ${String(n).padStart(3)}회  ${"█".repeat(Math.round((n / N) * 40))}`,
    )
  }

  const clean = buckets.get(1) ?? 0
  console.log(
    `\n왕복 1회로 끝난 비율: ${((clean / N) * 100).toFixed(0)}%  -> ${
      clean / N < 0.7
        ? "**링크가 요청마다 왕복을 더 쓴다. 앱 코드 원인 아님**"
        : "링크는 안정적. 느린 경로는 앱 코드에 원인이 있다"
    }`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
