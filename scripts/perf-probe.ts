/**
 * 쿼리별 왕복 시간 계측기. `npx tsx scripts/perf-probe.ts`
 *
 * 왜 별도 스크립트인가 — lib/prisma.ts는 고치지 않는다(공유 파일). 여기서 자체
 * PrismaClient를 만들어 계측만 한다. **읽기 전용이다.** 공유 개발 DB에 쓰지 않는다.
 *
 * 왜 필요한가 — RDS가 us-east-1이라 왕복 1회가 ~190ms다. "느리다"는 말로는 어느
 * 쿼리를 고쳐야 할지 알 수 없고, 왕복 수를 줄인 것과 페이로드를 줄인 것이 서로 다른
 * 개선인데 합쳐서 재면 구분이 안 된다. 그래서 쿼리 단위로 나눠 잰다.
 *
 * 수치가 없으면 "개선했다"는 말의 의미가 없다. 변경 전후에 이 스크립트를 같은
 * 인자로 돌려 비교한다.
 */
import { PrismaClient } from "@prisma/client"
import { MISSIONS_PER_STAGE } from "../lib/missions/bands"

const RUNS = Number(process.argv[2] ?? 5)
const EMAIL = process.argv[3] ?? "test@welli.local"

const prisma = new PrismaClient()

type Sample = { label: string; ms: number[]; rows: number; bytes: number }
const samples = new Map<string, Sample>()

/** 한 쿼리를 RUNS회 돌려 시간·행수·직렬화 바이트를 모은다 */
async function probe<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last!: T
  const ms: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    last = await fn()
    ms.push(performance.now() - t0)
  }
  const rows = Array.isArray(last) ? last.length : typeof last === "number" ? Number(last) : 1
  samples.set(label, { label, ms, rows, bytes: JSON.stringify(last ?? null).length })
  return last
}

function stats(ms: number[]) {
  const s = [...ms].sort((a, b) => a - b)
  return {
    min: s[0],
    p50: s[Math.floor(s.length / 2)],
    max: s[s.length - 1],
    avg: s.reduce((a, b) => a + b, 0) / s.length,
  }
}

async function main() {
  // 계측 대상 사용자. 없으면 아무 진단 완료 사용자로 떨어진다
  const user =
    (await prisma.user.findFirst({ where: { email: EMAIL } })) ??
    (await prisma.user.findFirst({ where: { typeCode: { not: null } } }))
  if (!user?.typeCode) {
    console.error("진단을 완료한 사용자가 없어 계측할 수 없다")
    process.exit(1)
  }
  const typeCode = user.typeCode
  const today = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).split(" ")[0]

  // 연결·TLS 수립을 계측에서 빼기 위한 워밍업.
  // **동시로** 8개를 내야 풀에 연결이 8개 열린다. 순차로 워밍업하면 연결이 1개만
  // 열리고, 뒤에서 Promise.all을 잴 때 TLS 핸드셰이크 비용이 그 수치에 섞인다
  // (그 오염된 값이 725ms였다. scripts/perf-pool.ts가 이 함정을 증명한다)
  await Promise.all(Array.from({ length: 8 }, (_, i) => prisma.$queryRaw`SELECT ${i}::int`))

  // ── 왕복 1회의 순수 비용. 다른 모든 수치의 기준선이다 ──────────────────────────
  await probe("기준선: SELECT 1", () => prisma.$queryRaw`SELECT 1`)

  // ── getCurrentUser()가 내는 쿼리 ─────────────────────────────────────────────
  await probe("getCurrentUser: user.findUnique", () =>
    prisma.user.findUnique({ where: { id: user.id } }),
  )

  // ── buildDashboard()의 6개 쿼리. 지금은 Promise.all로 병렬이지만 개별 비용을 본다 ──
  await probe("dashboard: DAILY 미션 전체", () =>
    prisma.mission.findMany({ where: { scope: "DAILY" }, orderBy: { order: "asc" } }),
  )
  await probe("dashboard: 오늘 DAILY 완료", () =>
    prisma.userMission.findMany({
      where: { userId: user.id, resetKey: today, mission: { scope: "DAILY" } },
      select: { missionId: true },
    }),
  )
  // 여기가 의심 지점 — 100단계 전체를 본문까지 들고 온다
  await probe("dashboard: STAGE 미션 전체(현행, 전체 컬럼)", () =>
    prisma.mission.findMany({
      where: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
      orderBy: [{ stage: "asc" }, { order: "asc" }],
    }),
  )
  // 대안 — 진행도 계산에 실제로 쓰이는 두 컬럼만
  await probe("dashboard: STAGE 미션 전체(대안, id+stage만)", () =>
    prisma.mission.findMany({
      where: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
      orderBy: [{ stage: "asc" }, { order: "asc" }],
      select: { id: true, stage: true },
    }),
  )
  await probe("dashboard: STAGE 완료 기록(관계 필터)", () =>
    prisma.userMission.findMany({
      where: {
        userId: user.id,
        resetKey: "STAGE",
        mission: { scope: "STAGE", typeCode, order: { lte: MISSIONS_PER_STAGE } },
      },
      select: { missionId: true },
    }),
  )
  await probe("dashboard: 주간 완료 수(count)", () =>
    prisma.userMission.count({
      where: { userId: user.id, resetKey: { lte: today }, mission: { scope: "DAILY" } },
    }),
  )
  await probe("dashboard: 출석 수령 여부(count)", () =>
    prisma.attendanceClaim.count({ where: { userId: user.id } }),
  )

  // ── 6개를 Promise.all로 함께 냈을 때의 벽시계. 병렬이 실제로 먹히는지 확인 ────────
  await probe("dashboard: 6개 Promise.all 벽시계", () =>
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

  // ── 출력 ─────────────────────────────────────────────────────────────────────
  const base = stats(samples.get("기준선: SELECT 1")!.ms).p50
  console.log(`\n왕복 ${RUNS}회씩. 기준선(SELECT 1) p50 = ${base.toFixed(0)}ms\n`)
  console.log(
    "  p50      avg      max     행수    KB   왕복환산  쿼리",
  )
  console.log("  " + "─".repeat(88))
  for (const s of samples.values()) {
    const t = stats(s.ms)
    const rt = t.p50 / base
    console.log(
      `${t.p50.toFixed(0).padStart(6)}ms ${t.avg.toFixed(0).padStart(6)}ms ${t.max
        .toFixed(0)
        .padStart(6)}ms ${String(s.rows).padStart(7)} ${(s.bytes / 1024)
        .toFixed(1)
        .padStart(6)} ${(rt.toFixed(1) + "x").padStart(8)}   ${s.label}`,
    )
  }

  // 페이로드 절감 폭을 바로 보여준다 — 이 스크립트를 만든 이유가 이 한 줄이다
  const full = samples.get("dashboard: STAGE 미션 전체(현행, 전체 컬럼)")!
  const slim = samples.get("dashboard: STAGE 미션 전체(대안, id+stage만)")!
  console.log(
    `\nSTAGE 미션 페이로드: ${(full.bytes / 1024).toFixed(1)}KB -> ${(slim.bytes / 1024).toFixed(
      1,
    )}KB (${(100 - (slim.bytes / full.bytes) * 100).toFixed(0)}% 감소), ` +
      `시간 ${stats(full.ms).p50.toFixed(0)}ms -> ${stats(slim.ms).p50.toFixed(0)}ms`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
