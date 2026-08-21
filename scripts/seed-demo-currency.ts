// 소유자: C. 데모·녹화 계정에 재화를 심는다. (SPEC.md 5절 "수급량 확정값")
//
// 왜 필요한가: 확정 수급으로는 스킨 39일·배경 36일·펫 27일이 걸린다. 8/26 녹화까지
// 실제로 모을 수 있는 기간이 아니라서 SPEC.md 5절이 "데모 계정에 시드로 넣는다"고
// 정해 뒀다. 이 스크립트가 그 확정값의 유일한 출처다.
//
// 왜 calculateReward()를 안 쓰는가: 저 함수는 앱 안에서 재화를 *획득*하는 경로에
// 배율을 얹는 것이고(CLAUDE.md 2절), 이건 앱 코드가 아니라 테스트 데이터 심기다.
// 배율을 태우면 "3,000개를 넣었는데 3,450개가 들어간다" — 검증값이 흐려진다.
//
// 공유 개발 DB에 쓴다. 실행은 사용자 승인을 받고 한다.
//   npx tsx scripts/seed-demo-currency.ts [이메일]
import { prisma } from "../lib/prisma"

/** 팀 공용 테스트 계정. docs/STATUS.md 차단 22번에 적혀 있다 */
const DEFAULT_EMAIL = "test@welli.local"

// 값의 근거는 SPEC.md 5절 수급표다. 바꿀 때 그 절도 같이 고친다.
const DEMO_CURRENCY = {
  /** 4단 진화(Lv.25) 누적치. 2단·3단·4단 연출을 순서대로 다 보여줄 수 있다 */
  seeds: 3000,
  /** 스킨 1종 정가. 구매 후 0이 되는 것까지 화면에 남는다 */
  starShards: 2500,
  /** 배경 6종 합계. 도감 진행률과 슬롯 교체를 둘 다 찍을 수 있다 */
  affinity: 3600,
} as const

async function main() {
  const email = process.argv[2] ?? DEFAULT_EMAIL

  const before = await prisma.user.findUnique({
    where: { email },
    select: { nickname: true, level: true, exp: true, seeds: true, starShards: true, affinity: true },
  })
  if (!before) throw new Error(`${email} 계정이 없습니다. scripts/create-local-user.ts를 먼저 돌립니다`)

  const after = await prisma.user.update({
    where: { email },
    // 레벨·경험치는 건드리지 않는다. 지금 지점에서 3,000이면 Lv.25까지 닿는다
    data: { ...DEMO_CURRENCY },
    select: { nickname: true, level: true, exp: true, seeds: true, starShards: true, affinity: true },
  })

  console.log(`${email} (${after.nickname})`)
  console.log(`  씨앗   ${before.seeds} → ${after.seeds}`)
  console.log(`  별조각 ${before.starShards} → ${after.starShards}`)
  console.log(`  친밀도 ${before.affinity} → ${after.affinity}`)
  console.log(`  레벨   Lv.${after.level} exp ${after.exp} (건드리지 않았다)`)
}

main().finally(() => prisma.$disconnect())
