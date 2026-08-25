import { auditCurriculum, planCurriculum } from "../prisma/seed/curriculum"

// 소유자: A. 100단계 배치 자기 점검. DB에 붙지 않는다 — 순수 계산만 본다.
const { problems, stats } = auditCurriculum()
console.log(stats)
if (problems.length > 0) {
  console.error("\n문제:")
  for (const p of problems) console.error(" -", p)
  process.exit(1)
}

// ── 복습 분포 (2026-08-24 추가) ──────────────────────────────────────────────
//
// 복습 대상을 고르는 규칙이 무너지면 사다리가 조용히 평평해진다. 2026-08-24 계측에서
// 세 가지가 동시에 어긋나 있었고(수치는 docs/dev/missions.md "복습 배치 계측"),
// 그 셋을 여기서 못 박는다. 규칙 자체는 prisma/seed/curriculum.ts pickReview 주석에 있다.
//
// 왜 개수·중복만으로는 안 잡히는가: 슬롯 수와 미션 수는 그대로인 채로 **어느 미션이
// 어느 슬롯에 오는지**만 바뀌기 때문이다. auditCurriculum()은 그걸 보지 않는다.
const bandOfStage = (stage: number) => Math.min(10, Math.max(1, Math.ceil(stage / 10)))
const distProblems: string[] = []

for (const typeCode of ["HEALTH_EMOTION", "INDEPENDENT_LOW_INCOME", "FAMILY_LIVING"] as const) {
  const pl = planCurriculum(typeCode)
  const first = new Map<string, number>()
  for (const p of pl) if (!first.has(p.mission.key)) first.set(p.mission.key, p.stage)
  const count = new Map<string, number>()
  for (const p of pl) count.set(p.mission.key, (count.get(p.mission.key) ?? 0) + 1)

  const reviews = pl.filter((p) => first.get(p.mission.key) !== p.stage)

  // 1. 1구간 쏠림. 고쳤을 때 14%였다 — 20%는 여유를 둔 상한이다.
  //    31%였을 때 면접을 다녀오는 94단계에 `기지개 한 번`이 들어갔다
  const band1 = reviews.filter((p) => bandOfStage(first.get(p.mission.key)!) === 1).length
  const pct = Math.round((band1 / reviews.length) * 100)
  if (pct > 20) distProblems.push(`${typeCode}: 복습 슬롯의 ${pct}%가 1구간 출신이다 (상한 20%)`)

  // 2. 사람 관련 미션(7~9구간)은 최소 2회 나온다. 한 번뿐이면 노출 위계의 마지막
  //    세 칸이 일회성 선언이 된다. DAILY에 대응이 없어 STAGE가 유일한 경로다
  for (const [key, at] of first) {
    const b = bandOfStage(at)
    if (b >= 7 && b <= 9 && (count.get(key) ?? 0) < 2) {
      const title = pl.find((p) => p.mission.key === key)!.mission.title
      distProblems.push(`${typeCode}: 7~9구간 \`${title}\`가 ${count.get(key)}회만 나온다 (최소 2회)`)
    }
  }

  // 3. 마지막 구간의 복습은 6구간 이후 출신만. "사회로 한 걸음"을 걷는 구간에서
  //    복습이 혼자 하는 일이면 사다리의 최상단이 최하단으로 되돌아간다
  const late = reviews.filter((p) => bandOfStage(p.stage) === 10)
  for (const p of late) {
    const b = bandOfStage(first.get(p.mission.key)!)
    if (b < 6) distProblems.push(`${typeCode}: ${p.stage}단계 복습이 ${b}구간 출신 \`${p.mission.title}\`이다`)
  }
}

if (distProblems.length > 0) {
  console.error("\n복습 분포 문제:")
  for (const p of distProblems) console.error(" -", p)
  process.exit(1)
}
console.log("복습 분포 3항목 통과 (1구간 쏠림 · 7~9구간 최소 2회 · 10구간 복습 출신)")

// 사람이 읽어 확인하는 표본. 구간 경계와 마지막 단계를 본다
const plan = planCurriculum("HEALTH_EMOTION")
for (const s of [1, 2, 5, 10, 11, 25, 40, 50, 55, 70, 85, 99, 100]) {
  const rows = plan.filter((p) => p.stage === s)
  console.log(`\n[${s}단계] ` + rows.map((r) => r.mission.title + (r.mission.photo ? "📷" : "")).join(" / "))
}
console.log("\n점검 통과")
