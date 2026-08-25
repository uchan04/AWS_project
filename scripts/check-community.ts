import assert from "node:assert/strict"
import { TOPICS, TOPIC_COUNT, TOPIC_TITLE_MAX, resolveTopicKey, pickTopics } from "@/app/community/_lib/topics"
import { pickHopeMessage, HOPE_MESSAGES } from "@/app/community/_lib/banner"
import { BANNED } from "@/lib/diagnosis/reason"
import { isCrisis } from "@/lib/safety"
import { crisisBlockedPayload, CRISIS_BLOCKED_NOTICE, BLAMING_WORDS } from "@/app/community/_lib/crisis"
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

/* ────────────────────────────────────────────────────────────
 * 위기 신호 글·댓글 (2026-08-25 팀 결정 변경)
 *
 * 이전: 저장하고 작성자에게 안내만 돌려줬다.
 * 지금: 저장하지 않고 안내만 돌려준다. 응답은 400이 아니라 200 + crisisBlocked 다.
 *
 * 라우트를 직접 부르지는 않는다 — 이 스크립트는 서버도 DB도 없이 도는 순수 함수 검사다.
 * 대신 두 라우트가 공유하는 판정(isCrisis)과 응답 본문(crisisBlockedPayload)을 여기서 고정한다.
 * ──────────────────────────────────────────────────────────── */

const CRISIS_SAMPLES = [
  "모든 걸 끝내고 싶다",
  "이제 다 살기 싫다",
  "그냥 죽고 싶다는 생각만 든다",
  "사라지고 싶어",
  "태어나지 않았으면 좋았을 텐데",
]

const ORDINARY_SAMPLES = [
  "오늘 창밖이 밝았다",
  "요즘 잠이 잘 안 온다",
  "밥을 늦게 먹었다",
]

for (const text of CRISIS_SAMPLES) {
  assert.ok(isCrisis(text), `위기 신호로 잡혀야 한다 — "${text}"`)
}
for (const text of ORDINARY_SAMPLES) {
  assert.ok(!isCrisis(text), `평범한 글까지 잡으면 안 된다 — "${text}"`)
}

const payload = crisisBlockedPayload()

// 저장된 것이 없다는 사실이 응답 모양으로 드러나야 한다.
// post·comment가 실려 나가면 화면이 목록에 밀어 넣는다(PostDetailModal이 그렇게 깨졌었다)
assert.equal(payload.crisisBlocked, true, "응답에 crisisBlocked: true 가 있다")
assert.ok(!("post" in payload), "저장하지 않았으므로 post를 담지 않는다")
assert.ok(!("comment" in payload), "저장하지 않았으므로 comment를 담지 않는다")
assert.ok(payload.notice.trim().length > 0, "안내 문구가 비어 있지 않다")

// 톤. 거절이 아니라 다른 길을 알려주는 자리다(_lib/crisis.ts 조건 3)
for (const word of BLAMING_WORDS) {
  assert.ok(
    !payload.notice.includes(word),
    `안내 문구가 거절로 읽힌다 — "${word}"가 들어 있다: "${payload.notice}"`,
  )
}
assert.ok(
  !/해\s?보세요|하세요|해야/.test(payload.notice),
  `안내 문구가 조언이다 — "${payload.notice}"`,
)

// lib/safety.ts의 CRISIS_POST_NOTICE는 "올라갔어요"로 시작한다 — 저장하던 시절의 문장이다.
// 그걸 그대로 쓰면 올리지 않은 글을 올렸다고 알리게 된다
assert.ok(
  !CRISIS_BLOCKED_NOTICE.includes("올라갔어요"),
  "안내가 글이 올라갔다고 말하면 안 된다 — 저장하지 않았다",
)

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
 * 자기를 향한 욕이 섞이기 쉽다. `{ crisis }`를 주면 사전 차단만 풀리고 대상 있는 욕설은
 * 그대로 막힌다 — 여기서 재는 것은 `moderate()`의 그 계약이다.
 *
 * **2026-08-25 이후 두 라우트는 이 인자를 넘기지 않는다.** 위기 신호 글은 검열에 닿기 전에
 * 저장 없이 돌아가기 때문이다(위 "위기 신호 글·댓글" 절). 그래도 이 검사는 남겨둔다 —
 * `moderate()`가 가진 보장이고, 위기 신호를 다시 저장하는 쪽으로 되돌릴 때 필요하다.
 *
 * Bedrock은 부르지 않는다. 1~3번은 `invokeModel`을 아예 넘기지 않고, 2단계까지 재는
 * 4번은 고정 JSON을 돌려주는 스텁을 넘긴다.
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

  /*
   * 4. 2단계(Bedrock 문맥 판정)까지 갔을 때의 계약.
   *
   * 스텁을 넘겨 Bedrock 없이 잰다 — moderate()의 invokeModel 인자가 그 자리다.
   * 위기 신호가 사전 차단을 열어주므로 이 문장은 실제로 모델 단계까지 온다.
   *
   * **모델이 BLOCK을 줄 때는 위기 신호가 있어도 막는다. 의도한 동작이다.**
   * JUDGE_SYSTEM의 BLOCK 정의가 "다른 사람이나 집단을 향한 욕설·비하 호칭·조롱·위협·차별"
   * 이라, BLOCK 자체가 곧 "남을 향한 공격"이다. 자기를 향한 말은 그 taxonomy에서 SELF로
   * 갈라져 나오고 SELF·WARN·OK는 아래처럼 이미 통과한다. 응답에는 verdict와 자유 문장
   * reason뿐이라 BLOCK 안을 더 가를 필드가 없다 — 그래서 BLOCK은 열지 않는다.
   */
  const crisisSelfBlame = "죽고 싶다. 나 진짜 병신 같아"
  const judge = (verdict: string) => async () => JSON.stringify({ verdict, reason: "검사" })
  assert.equal(isCrisis(crisisSelfBlame), true, "위기 신호가 있어야 하는 문장이다")

  for (const verdict of ["SELF", "WARN", "OK"]) {
    assert.notEqual(
      (await moderate(crisisSelfBlame, judge(verdict), { crisis: true })).verdict,
      "BLOCK",
      `위기 신호 글을 모델이 ${verdict}로 봤는데 막혔다`,
    )
  }

  assert.equal(
    (await moderate(crisisSelfBlame, judge("BLOCK"), { crisis: true })).verdict,
    "BLOCK",
    "모델 BLOCK은 위기 신호가 있어도 막는다(BLOCK = 남을 향한 공격)",
  )
}

checkCrisisModeration()
  .then(() => {
    console.log(
      `community 체크 통과 (제목 ${titleChecked}개 × 갤러리 ${TOPIC_GALLERIES.length}, 희망 문구 ${hopeChecked}개 × 갤러리 ${GALLERIES.length}, 위기 신호 검열 3케이스 + 모델 판정 4케이스, 위기 신호 판정 ${CRISIS_SAMPLES.length + ORDINARY_SAMPLES.length}건) — 위기 신호 글은 저장하지 않고 200 + crisisBlocked로 안내한다`,
    )
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
