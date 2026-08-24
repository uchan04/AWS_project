// 소유자: A. 단계 미션 커리큘럼의 뼈대 상수.
//
// 여기에 import를 두지 않는다. prisma/seed/curriculum.ts(Node 스크립트)와
// app/missions/*(클라이언트 컴포넌트)가 같은 값을 읽어야 하는데, 한쪽이라도
// @/lib/prisma를 끌어오면 시드 스크립트가 두 번째 PrismaClient를 만들거나
// 클라이언트 번들에 서버 코드가 섞인다.
//
// 2026-08-22: 단계를 3개 → 100개로 늘렸다. 난이도는 고립은둔 회복 순서를 따른다 —
// 방 안 → 집 안 → 문 앞 → 동네 → 시설 → 멀리 → 한마디 → 대화 → 관계 → 사회.
// 100단계를 끝내면 "정기적으로 나가고, 사람과 약속을 잡고, 배우거나 일을 알아보는"
// 상태가 된다. 그것이 이 커리큘럼의 종착점이다.

export const STAGES_PER_BAND = 10
export const BAND_COUNT = 10
export const TOTAL_STAGES = STAGES_PER_BAND * BAND_COUNT // 100

/** 한 단계에 놓이는 미션 수. 늘리면 300 슬롯이 그만큼 늘어난다 */
export const MISSIONS_PER_STAGE = 3

/**
 * 다음 단계를 열기 위해 필요한 완료 수.
 * 3개 중 2개로 둔 이유: 오늘 도저히 못 하는 미션 하나가 100단계 전체를 막으면 안 된다.
 * (예: 사진 미션인데 나갈 수 없는 날)
 */
export const REQUIRED_PER_STAGE = 2

/** 1~100 → 1~10. 범위를 벗어난 값도 구간 안으로 접는다 */
export function bandOf(stage: number): number {
  const band = Math.ceil(stage / STAGES_PER_BAND)
  return Math.min(BAND_COUNT, Math.max(1, band))
}

/** 화면에 그대로 띄우는 구간 이름. 유형 이름은 절대 넣지 않는다(낙인 위험) */
export const BAND_LABELS: readonly string[] = [
  "방 안에서", // 1: 1~10
  "집 안 생활", // 2: 11~20
  "문 앞까지", // 3: 21~30
  "동네 한 바퀴", // 4: 31~40
  "가게와 시설", // 5: 41~50
  "조금 더 멀리", // 6: 51~60
  "한마디 건네기", // 7: 61~70
  "대화와 모임", // 8: 71~80
  "관계 이어가기", // 9: 81~90
  "사회로 한 걸음", // 10: 91~100
]

export function bandLabel(stage: number): string {
  return BAND_LABELS[bandOf(stage) - 1] ?? ""
}

/**
 * 단계 보상. 구간이 올라갈수록 오른다.
 *
 * 씨앗 22~58, 별조각 0~8. 100단계 전체 수입은 씨앗 12,000 / 별조각 1,080이다
 * (300슬롯 기준). 변형 스킨이 2,500이므로 별조각은 끝까지 아껴 쓰는 자원으로 남는다.
 *
 * 친밀도는 0이다. 미션에서도 주면 커뮤니티·채팅 지급과 겹쳐 하루 상한을
 * 미션만으로 채워버린다(lib/reward.ts capAffinity).
 */
export function rewardForStage(stage: number): { seeds: number; shards: number } {
  const band = bandOf(stage)
  return {
    seeds: 18 + band * 4,
    // 3구간(문 앞까지)부터 붙는다. 방 안 미션에 별조각을 주면 나가지 않는 쪽이 이득이 된다
    shards: Math.max(0, band - 2),
  }
}
