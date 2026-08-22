// 커뮤니티 주제 추천의 출력 검사. Bedrock 없이 도는 부분만 고정한다.
// 낙인 단어 차단이 이 기능의 유일한 안전장치이므로 모델의 선의에 맡기지 않는다.
//
//   npm run check:community

import assert from "node:assert/strict"
import { TOPIC_COUNT, validateTopics } from "@/lib/community/topics"
import { TOPICS } from "@/app/community/_lib/topics"
import { hopeMessageOfWeek, HOPE_MESSAGES } from "@/app/community/_lib/hope"
import type { TypeCode } from "@prisma/client"

const GOOD = [
  { title: "오늘 창밖 풍경", draft: "커튼을 열었더니 밖이 생각보다 밝았다. 잠깐 그대로 서 있었다." },
  { title: "혼자 먹은 끼니", draft: "오늘은 있는 걸로 대충 때웠다. 그래도 따뜻한 걸 먹으니 좀 나았다." },
  { title: "미뤄둔 설거지", draft: "싱크대에 며칠째 그릇이 쌓여 있다. 오늘도 그냥 지나쳤다." },
]

assert.equal(validateTopics(GOOD).length, TOPIC_COUNT, "정상 3개는 통과한다")
assert.throws(() => validateTopics(GOOD.slice(0, 2)), /개수/, "2개는 막는다")
assert.throws(() => validateTopics("주제"), /개수/, "배열이 아니면 막는다")
assert.throws(
  () => validateTopics([...GOOD.slice(0, 2), { title: "  ", draft: "내용은 있다." }]),
  /제목 길이/,
  "빈 제목은 막는다",
)
assert.throws(
  () => validateTopics([...GOOD.slice(0, 2), { title: "제목이 스무 자를 넘어가는 아주 긴 제목입니다", draft: "내용." }]),
  /제목 길이/,
  "20자를 넘는 제목은 막는다",
)
assert.throws(
  () => validateTopics([...GOOD.slice(0, 2), { title: "설거지", draft: "  " }]),
  /초안 길이/,
  "빈 초안은 막는다",
)
assert.throws(
  () => validateTopics([...GOOD.slice(0, 2), { title: "긴 초안", draft: "가".repeat(91) }]),
  /초안 길이/,
  "90자를 넘는 초안은 막는다",
)
assert.throws(() => validateTopics([GOOD[0], GOOD[0], GOOD[1]]), /중복/, "같은 제목 두 개는 막는다")
assert.throws(
  () => validateTopics([...GOOD.slice(0, 2), { title: "고립된 하루", draft: "오늘도 혼자였다." }]),
  /쓸 수 없는 단어/,
  "낙인 단어는 막는다",
)
assert.throws(
  () => validateTopics([...GOOD.slice(0, 2), { title: "내 유형 이야기", draft: "분류를 보고 왔다." }]),
  /쓸 수 없는 단어/,
  "유형·분류는 막는다",
)

// 대비책으로 쓰는 고정 문구도 같은 검사를 통과해야 한다. 여기서 걸러지면
// LLM이 실패한 순간에 화면이 검사도 못 지난 문구를 띄우게 된다
let fallbackChecked = 0
for (const [code, list] of Object.entries(TOPICS) as [TypeCode, typeof GOOD][]) {
  assert.ok(list.length >= TOPIC_COUNT, `${code} 고정 문구가 ${TOPIC_COUNT}개보다 적다`)
  for (let i = 0; i + TOPIC_COUNT <= list.length; i += TOPIC_COUNT) {
    validateTopics(list.slice(i, i + TOPIC_COUNT))
    fallbackChecked += TOPIC_COUNT
  }
}

// 희망 문구 배너(SPEC 9절). 한 주 안에서는 같은 문구가 나오고, 주가 넘어가면 바뀐다
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const base = new Date(1_780_000_000_000)
assert.equal(
  hopeMessageOfWeek(base),
  hopeMessageOfWeek(new Date(base.getTime() + 6 * 24 * 60 * 60 * 1000)),
  "같은 주에는 같은 문구다",
)
const overWeeks = new Set(
  Array.from({ length: HOPE_MESSAGES.length }, (_, i) => hopeMessageOfWeek(new Date(base.getTime() + i * WEEK_MS))),
)
assert.equal(overWeeks.size, HOPE_MESSAGES.length, "문구 개수만큼 주가 지나면 전부 한 번씩 나온다")
assert.equal(
  hopeMessageOfWeek(base),
  hopeMessageOfWeek(new Date(base.getTime() + HOPE_MESSAGES.length * WEEK_MS)),
  "한 바퀴 돌면 처음 문구로 돌아온다",
)

console.log(
  `community 체크 통과 (주제 검증 11, 고정 문구 ${fallbackChecked}개, 희망 문구 3) — 고정 문구는 LLM 실패 시 대비책이다`,
)
