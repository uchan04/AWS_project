import { auditCurriculum, planCurriculum } from "../prisma/seed/curriculum"

// 소유자: A. 100단계 배치 자기 점검. DB에 붙지 않는다 — 순수 계산만 본다.
const { problems, stats } = auditCurriculum()
console.log(stats)
if (problems.length > 0) {
  console.error("\n문제:")
  for (const p of problems) console.error(" -", p)
  process.exit(1)
}

// 사람이 읽어 확인하는 표본. 구간 경계와 마지막 단계를 본다
const plan = planCurriculum("HEALTH_EMOTION")
for (const s of [1, 2, 5, 10, 11, 25, 40, 50, 55, 70, 85, 99, 100]) {
  const rows = plan.filter((p) => p.stage === s)
  console.log(`\n[${s}단계] ` + rows.map((r) => r.mission.title + (r.mission.photo ? "📷" : "")).join(" / "))
}
console.log("\n점검 통과")
