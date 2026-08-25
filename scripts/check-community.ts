import assert from "node:assert/strict"
import { TOPICS, TOPIC_COUNT, TOPIC_TITLE_MAX, resolveTopicKey, pickTopics } from "@/app/community/_lib/topics"
import { pickHopeMessage, HOPE_MESSAGES } from "@/app/community/_lib/banner"
import { BANNED } from "@/lib/diagnosis/reason"
import type { GalleryType, TypeCode } from "@prisma/client"

// 주제 추천은 2026-08-25부터 **제목만** 준다. 초안(draft)이 없어졌고 LLM 추천도 껐다.
// 그래서 여기서 검사하던 lib/community/topics.ts의 validateTopics()는 더 이상 쓰이지 않는다
// (그 파일은 아무도 부르지 않는다). 대신 이 파일의 문구가 유일한 출처가 됐으므로
// 낙인 단어 검사를 문구 전체에 직접 건다 — 이 기능의 유일한 안전장치다.

const TOPIC_GALLERIES = Object.keys(TOPICS) as GalleryType[]

assert.equal(TOPIC_GALLERIES.length, 4, "갤러리 4개(전체 + 종족 3)에 각각 제목 목록이 있다")

let titleChecked = 0
for (const gallery of TOPIC_GALLERIES) {
  const titles = TOPICS[gallery]

  assert.ok(titles.length >= TOPIC_COUNT, `${gallery} 제목이 ${TOPIC_COUNT}개보다 적다`)
  assert.equal(new Set(titles).size, titles.length, `${gallery}: 같은 제목이 두 번 있다`)

  for (const title of titles) {
    assert.ok(title.trim().length > 0, `${gallery}: 빈 제목이 있다`)
    assert.ok(
      title.length <= TOPIC_TITLE_MAX,
      `${gallery}: 제목이 ${TOPIC_TITLE_MAX}자를 넘는다 — "${title}" (${title.length}자)`,
    )

    // 낙인 단어(lib/diagnosis/reason.ts). 배너와 같은 목록을 쓴다
    const hit = BANNED.find((word) => title.includes(word))
    assert.equal(hit, undefined, `${gallery}: 제목에 낙인 단어 "${hit}"가 있다 — "${title}"`)

    // 권유형 금지. 소재를 주는 것이지 조언이 아니다(docs/dev/community.md 문구 규칙)
    assert.ok(
      !/해\s?보세요|하세요|해야/.test(title),
      `${gallery}: 제목이 조언이다 — "${title}"`,
    )
    titleChecked += 1
  }
}

// 전체 탭은 종족을 아는 사람에게 그 종족 목록을, 진단 전인 사람에게 ALL 목록을 준다
assert.equal(resolveTopicKey("ALL", null), "ALL", "진단 전 전체 탭은 ALL 문구다")
assert.equal(
  resolveTopicKey("ALL", "HEALTH_EMOTION" as TypeCode),
  "HEALTH_EMOTION",
  "진단을 마쳤으면 전체 탭에서도 내 종족 문구다",
)
assert.equal(
  resolveTopicKey("FAMILY_LIVING" as GalleryType, "HEALTH_EMOTION" as TypeCode),
  "FAMILY_LIVING",
  "종족 갤러리는 그 갤러리 문구다",
)

// 뽑기는 개수를 지키고 같은 제목을 두 번 주지 않는다
for (const gallery of TOPIC_GALLERIES) {
  const picked = pickTopics(gallery, null)
  assert.equal(picked.length, TOPIC_COUNT, `${gallery}: ${TOPIC_COUNT}개를 뽑는다`)
  assert.equal(new Set(picked).size, TOPIC_COUNT, `${gallery}: 뽑은 제목이 겹친다`)
}

// 희망 문구 배너(SPEC 9절). 갤러리 4개가 각자 배열을 갖는다(app/community/_lib/banner.ts).
// 한 주 안에서는 같은 문구가 나오고, 주가 넘어가면 바뀐다.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const base = new Date(1_780_000_000_000)
const GALLERIES = Object.keys(HOPE_MESSAGES) as GalleryType[]

assert.equal(GALLERIES.length, 4, "갤러리 4개(전체 + 종족 3)에 각각 문구 배열이 있다")

let hopeChecked = 0
for (const gallery of GALLERIES) {
  const messages = HOPE_MESSAGES[gallery]
  assert.ok(messages.length >= 3, `${gallery} 문구가 3개보다 적다 (SPEC 9절: 3~5개)`)

  assert.equal(
    pickHopeMessage(gallery, base),
    pickHopeMessage(gallery, new Date(base.getTime() + 6 * 24 * 60 * 60 * 1000)),
    `${gallery}: 같은 주에는 같은 문구다`,
  )

  const overWeeks = new Set(
    Array.from({ length: messages.length }, (_, i) =>
      pickHopeMessage(gallery, new Date(base.getTime() + i * WEEK_MS)),
    ),
  )
  assert.equal(overWeeks.size, messages.length, `${gallery}: 문구 개수만큼 주가 지나면 전부 한 번씩 나온다`)

  assert.equal(
    pickHopeMessage(gallery, base),
    pickHopeMessage(gallery, new Date(base.getTime() + messages.length * WEEK_MS)),
    `${gallery}: 한 바퀴 돌면 처음 문구로 돌아온다`,
  )

  // banner.ts 상단 주석의 톤 규칙 중 "유형명을 절대 쓰지 않는다"를 실제로 검사한다.
  // 주제 추천과 같은 목록(lib/diagnosis/reason.ts의 BANNED)을 쓴다 — 배너는 로그인한
  // 모든 사람이 보는 자리라 낙인 단어가 새면 주제 추천보다 노출이 크다
  for (const message of messages) {
    const hit = BANNED.find((word) => message.includes(word))
    assert.equal(hit, undefined, `${gallery}: 배너 문구에 낙인 단어 "${hit}"가 있다 — "${message}"`)
    // "~해보세요"류 조언 금지도 같은 주석의 규칙이다. 조언은 압박으로 읽힌다
    assert.ok(!/해\s?보세요|하세요|해야/.test(message), `${gallery}: 배너 문구가 조언이다 — "${message}"`)
    hopeChecked += 1
  }
}

console.log(
  `community 체크 통과 (제목 ${titleChecked}개 × 갤러리 ${TOPIC_GALLERIES.length}, 희망 문구 ${hopeChecked}개 × 갤러리 ${GALLERIES.length}) — 주제 추천은 제목만 주며 LLM을 쓰지 않는다`,
)
