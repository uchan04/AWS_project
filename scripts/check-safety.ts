// 위기 감지·타인 공격 판정의 양방향 검사(lib/safety.ts).
//
//   npm run check:safety
//
// **오탐 쪽을 더 많이 검사한다.** 이 서비스는 고립은둔 청년이 자기 상태를 털어놓는
// 공간이고, 자기 비하("오늘 너무 한심했다")나 가족 이야기("어머니가 죽었으면 어쩌지")를
// 차단하면 기능이 있는 것보다 없는 것이 낫다. 미탐(놓침)은 systemPrompt.ts 안전 절이
// 2차로 받지만, 오탐은 그 자리에서 사람을 내보낸다.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { isCrisis, containsAbuse, CRISIS_HOTLINE, CRISIS_REPLY, CRISIS_POST_NOTICE } from "@/lib/safety"

// ── 1. 위기 신호는 잡는다. 띄어쓴 형태와 붙여 쓴 형태를 같이 확인한다
const CRISIS_HITS = [
  "죽고 싶다",
  "죽고싶어",
  "그냥 죽어버리고 싶어",
  "죽는 게 낫다",
  "자살",
  "자해했어요",
  "목숨을 끊고 싶어",
  "삶을 끝내고 싶다",
  "이번 생 끝내고 싶어",
  "모든 걸 끝내고 싶다",
  "사라지고 싶어요",
  "없어지고 싶다",
  "살기 싫어",
  "살고 싶지 않아",
  "태어나지 않았으면 좋았을 텐데",
]
for (const text of CRISIS_HITS) {
  assert.equal(isCrisis(text), true, `위기 신호를 놓쳤다: ${text}`)
}

// ── 2. 위기로 보지 않는 문장. 여기서 true가 나오면 고정 응답이 정상 대화를 가로챈다
const CRISIS_MISSES = [
  "과제를 다 끝내고 싶다", // `다 끝내`를 패턴에서 뺀 이유
  "이 일을 끝내고 싶다",
  "오늘 너무 힘들었다", // 맨 `힘들`은 이 서비스의 정상 대화다
  "요즘 우울해요",
  "엄마가 죽을까 봐 무섭다", // `죽을까`를 뺀 이유 — 타인 걱정에 고정 응답은 말을 잘못 받는다
  "매운 게 죽이는 맛이었다",
  "밖에 나가기 싫어",
]
for (const text of CRISIS_MISSES) {
  assert.equal(isCrisis(text), false, `정상 대화를 위기로 잡았다: ${text}`)
}

// ── 3. 타인 공격은 막는다
const ABUSE_HITS = [
  "병신아",
  "새끼야",
  "너 진짜 병신이네",
  "넌 진짜 한심하다",
  "니가 죽었으면 좋겠다",
  "당신 같은 새끼는 처음 봤다",
  "너 꺼져",
  "저놈 진짜 찌질하다",
]
for (const text of ABUSE_HITS) {
  assert.equal(containsAbuse(text), true, `타인 공격을 놓쳤다: ${text}`)
}

// ── 4. **차단하면 안 되는 문장.** 이 목록이 이 파일의 핵심이다
const ABUSE_MISSES = [
  "씨발 오늘 너무 힘들었다", // 대상 없는 혼잣말. 욕설 자체는 막지 않는다
  "씨발 아 진짜 짜증나", // 호격에 공백을 허용하면 걸린다
  "내 인생 쓰레기 같아", // 자기 비하
  "오늘 너무 한심했다", // `너무`의 `너`가 2인칭으로 새면 걸린다
  "나 진짜 병신 같다", // 자기 비하
  "어머니가 죽었으면 어쩌지", // `어머니가`의 `니가`가 새면 걸린다
  "어머니가 한심하다고 했다",
  "방 불이 꺼져 있었다", // `꺼져` 단독 패턴을 없앤 이유
  "닥쳐오는 불안이 무섭다",
  "얘기 들으니 한심했다", // `얘`를 2인칭에서 뺀 이유
  "언니가 병원에 갔다",
  "작년에는 더 심했다",
]
for (const text of ABUSE_MISSES) {
  assert.equal(containsAbuse(text), false, `정상 글을 공격으로 막았다: ${text}`)
}

// ── 5. 번호. 틀린 번호는 번호가 없는 것보다 나쁘다
assert.equal(CRISIS_HOTLINE, "109", "자살예방 상담전화는 109다(2024년 1393 통합)")

// 옛 번호가 되살아나는 것을 소스 수준에서 막는다. 상수만 검사하면 다른 문구(고정 응답,
// 안내 문장)에 번호가 하나 더 남아 있어도 통과한다.
// 주석은 뺀다 — safety.ts는 "옛 번호를 되살리지 않는다"는 기록을 주석에 남기고 있고,
// 그 기록이 선의의 되돌리기를 막는 장치다
const source = readFileSync(new URL("../lib/safety.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*/g, "")
for (const dead of ["1393", "1577"]) {
  assert.equal(source.includes(dead), false, `폐지된 번호가 코드에 남아 있다: ${dead}`)
}

assert.equal(CRISIS_REPLY.includes(CRISIS_HOTLINE), true, "고정 응답에 번호가 있어야 한다")
// 안내 문구는 CrisisNotice의 전화 버튼과 같이 뜬다. 번호가 두 번 나오면 안 된다
assert.equal(CRISIS_POST_NOTICE.includes(CRISIS_HOTLINE), false, "커뮤니티 안내 문구는 번호를 넣지 않는다")

// ── 6. 빈 입력·공백에서 터지지 않는다
assert.equal(isCrisis(""), false)
assert.equal(containsAbuse(""), false)

console.log(
  `안전 검사 통과 · 위기 ${CRISIS_HITS.length}건 잡고 ${CRISIS_MISSES.length}건 통과 · ` +
    `공격 ${ABUSE_HITS.length}건 막고 ${ABUSE_MISSES.length}건 통과`,
)
