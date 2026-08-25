import assert from "node:assert/strict"
import { TOPICS, TOPIC_COUNT, TOPIC_TITLE_MAX, resolveTopicKey, pickTopics } from "@/app/community/_lib/topics"
import { pickHopeMessage, HOPE_MESSAGES } from "@/app/community/_lib/banner"
import { BANNED } from "@/lib/diagnosis/reason"
import { isCrisis } from "@/lib/safety"
import { moderate } from "@/app/community/_lib/moderation"
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

/*
 * 위기 신호 글이 검열에 걸리지 않는지 본다(2026-08-25, 차단 30번).
 *
 * `moderate()`의 사전 차단(POLICY = BLANKET)은 대상이 없는 욕설까지 막는데, 절박한 글에는
 * 자기를 향한 욕이 섞이기 쉽다. 그래서 라우트가 `isCrisis()`를 검열보다 **먼저** 재고
 * 그 값을 `{ crisis }`로 넘긴다. 여기서 재는 것은 그 계약이다 —
 * 위기 신호가 있으면 사전 차단만 풀리고, 대상 있는 욕설은 그대로 막혀야 한다.
 *
 * `invokeModel`을 넘기지 않는다. Bedrock 없이 도는 1단계(사전·규칙)만 고정한다.
 */
async function checkCrisisModeration() {
  // 1. 위기 신호 + 대상 없는 욕설 → 통과해야 한다. 막으면 상담 안내가 닿지 못한다
  const crisisWithProfanity = "죽고 싶다. 시발 진짜 다 싫다"
  assert.equal(isCrisis(crisisWithProfanity), true, "위기 신호를 못 읽으면 이 검사가 무의미하다")
  const passed = await moderate(crisisWithProfanity, undefined, { crisis: true })
  assert.notEqual(
    passed.verdict,
    "BLOCK",
    `위기 신호 글이 욕설 때문에 막혔다 — 상담 안내 대신 400이 나간다 (hits: ${passed.hits.join(",")})`,
  )

  // 2. 위기 신호가 없으면 종전대로 막는다. 1번이 정책을 통째로 푼 것이 아님을 못박는다
  const profanityOnly = "시발 진짜 다 싫다"
  assert.equal(isCrisis(profanityOnly), false, "위기 신호가 없어야 하는 문장이다")
  assert.equal(
    (await moderate(profanityOnly, undefined, { crisis: false })).verdict,
    "BLOCK",
    "위기 신호 없는 욕설은 종전대로 막는다",
  )
  // 같은 문장을 crisis 없이 부른 경우(기본값)도 같다 — 세 번째 인자는 선택이다
  assert.equal((await moderate(profanityOnly)).verdict, "BLOCK", "opts 없이 불러도 종전과 같다")
  // 1번 문장도 crisis=false로 부르면 막힌다. 통과시킨 것이 위기 신호임을 확인한다
  assert.equal(
    (await moderate(crisisWithProfanity, undefined, { crisis: false })).verdict,
    "BLOCK",
    "1번이 통과한 이유는 crisis 플래그다",
  )

  // 3. 위기 신호가 있어도 대상 있는 욕설은 막는다.
  //    "죽고싶다"를 덧붙여 남을 공격하는 우회를 열어주지 않는다
  const crisisWithTargetedAbuse = "죽고 싶다. 너 죽어"
  assert.equal(isCrisis(crisisWithTargetedAbuse), true, "위기 신호가 있어야 하는 문장이다")
  assert.equal(
    (await moderate(crisisWithTargetedAbuse, undefined, { crisis: true })).verdict,
    "BLOCK",
    "위기 신호를 붙여도 대상 있는 욕설은 막는다",
  )
}

checkCrisisModeration()
  .then(() => {
    console.log(
      `community 체크 통과 (제목 ${titleChecked}개 × 갤러리 ${TOPIC_GALLERIES.length}, 희망 문구 ${hopeChecked}개 × 갤러리 ${GALLERIES.length}, 위기 신호 검열 3케이스) — 주제 추천은 제목만 주며 LLM을 쓰지 않는다`,
    )
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
