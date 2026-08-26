// 소유자: C. 데모·녹화 계정에 재화를 심는다. (SPEC.md 5절 "수급량 확정값")
//
// 왜 필요한가: 확정 수급으로는 스킨 약 30일·배경 약 36일·펫 약 27일이 걸린다. 8/26 녹화까지
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
//
// 2026-08-25 전환으로 배경값이 친밀도 → 별조각이 됐다. 그래서 별조각이 두 상점의 합
// (스킨 1종 + 배경 6종)이 되고, 친밀도는 외출 비용만 남는다. **합계를 그대로 옮긴 것이
// 아니다** — 배경 6종이 3600(친밀도)에서 3000(별조각)으로 내려갔기 때문이다.
const DEMO_CURRENCY = {
  /** 4단 진화(Lv.25) 누적치. 2단·3단·4단 연출을 순서대로 다 보여줄 수 있다 */
  seeds: 3000,
  /** 스킨 1종 2500 + 배경 6종 3000. 두 상점을 다 찍고 잔액 0으로 끝난다 */
  starShards: 5500,
  /**
   * 펫 외출 2회분(200 × 2). 3600이었던 것은 배경 6종 값이었고 그 소모처가 없어졌다 —
   * 큰 숫자를 남겨 두면 화면의 "친밀도 200 → 4시간"이 무의미하게 보인다.
   * 2회로 둔 이유: 보내고 받은 뒤 한 번 더 보낼 수 있어 IDLE·AWAY·RETURNED 세 상태를
   * 순서대로 찍고도 다시 IDLE에서 시작할 수 있다
   */
  affinity: 400,
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
