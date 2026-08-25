import type { GalleryType, TypeCode } from "@prisma/client"

/**
 * 글쓰기 창의 주제 추천. **제목만 준다 — 초안은 만들지 않는다.**
 *
 * 2026-08-25 결정(사용자): 모든 갤러리에서 제목만 제안한다. 그전에는 제목과 초안
 * (`{ title, draft }`)을 함께 줬고, 고르면 본문까지 채워졌다. 초안을 없앤 이유는
 * 채워진 문장이 그 사람의 하루를 대신 규정하기 때문이다 — "오늘은 있는 걸로 대충
 * 때웠다"가 이미 적혀 있으면 그렇지 않았던 사람은 지우고 다시 쓰는 일부터 해야 한다.
 * 제목만 주면 소재만 건네고 판단은 비워 둘 수 있다.
 *
 * 같은 날 **LLM 추천도 껐다.** 전에는 `GET /api/community/topics`가 Bedrock으로
 * 만들고(`lib/community/topics.ts`) 이 목록은 대비책이었다. 이제 이 파일이 유일한
 * 출처다 — `lib/community/topics.ts`는 아무도 부르지 않는다.
 *
 * 문구 규칙(`docs/dev/community.md`):
 * 오늘 하루 안에서 쓸 수 있는 가벼운 소재만. 성취·극복을 요구하지 않는다.
 * 권유형("~해보세요")을 쓰지 않는다. 밖에 나가거나 사람을 만나는 것을 전제하지 않는다.
 * 유형명·낙인 단어(`lib/diagnosis/reason.ts`의 BANNED)를 쓰지 않는다.
 *
 * 문구를 고치면 `npm run check:community`를 돌린다.
 */

/** 한 번에 보여주는 개수 */
export const TOPIC_COUNT = 3

/**
 * 제목 길이 상한. 사용자가 자기 이야기를 채워 넣을 여지를 남기는 길이다 —
 * 길어질수록 제목이 이미 결론을 말해버린다.
 */
export const TOPIC_TITLE_MAX = 15

/**
 * 갤러리별 제목 6개. `GalleryType`(종족 3종 + ALL)을 그대로 키로 쓴다.
 *
 * `ALL`은 종족을 모르는 사람(진단 전)이 전체 탭에서 볼 목록이다. 종족을 아는 사람은
 * 전체 탭에서도 자기 종족 목록을 본다 — 추천의 기준은 갤러리가 아니라 사용자 성향이다
 * (`resolveTopicKey()` 참고). 그래서 ALL 문구는 어느 종족에게도 기울지 않게 썼다.
 */
export const TOPICS: Record<GalleryType, string[]> = {
  ALL: [
    "창밖을 봤던 잠깐",
    "오늘 마신 것",
    "미뤄둔 채로 둔 일",
    "오늘 들린 소리",
    "오래 머문 자리",
    "오늘 문득 든 생각",
  ],
  INDEPENDENT_LOW_INCOME: [
    "오늘 창밖 풍경",
    "혼자 먹은 끼니",
    "방 안에서 들리는 소리",
    "오늘 가장 조용했던 시간",
    "미뤄둔 설거지",
    "밤에 틀어두는 소리",
  ],
  HEALTH_EMOTION: [
    "오늘 일어난 시각",
    "아무것도 안 한 하루",
    "요즘 자주 드는 생각",
    "오늘 유일하게 한 일",
    "몸이 무겁던 날",
    "잠이 안 오던 밤",
  ],
  FAMILY_LIVING: [
    "방문을 닫는 순간",
    "거실을 지나가며",
    "집인데 낯설던 순간",
    "혼자 있고 싶던 시간",
    "밥상 앞에서",
    "다들 잠든 뒤에",
  ],
}

/**
 * 어느 목록을 쓸지 고른다.
 *
 * 종족 갤러리는 그 갤러리 목록을 쓴다. 전체 탭은 **내 종족** 목록을 쓴다 —
 * 추천의 기준은 "지금 보고 있는 갤러리"가 아니라 "이 사람의 성향"이기 때문이다.
 * 진단 전이라 종족이 없으면 ALL로 떨어진다.
 */
export function resolveTopicKey(gallery: GalleryType, myTypeCode: TypeCode | null): GalleryType {
  if (gallery !== "ALL") return gallery
  return myTypeCode ?? "ALL"
}

/**
 * 목록에서 `TOPIC_COUNT`개를 무작위로 고른다. Fisher-Yates 직접 구현이며
 * 외부 라이브러리를 쓰지 않는다(`ChatPanel.pickThreeStarters()`와 같은 방식).
 */
export function pickTopics(gallery: GalleryType, myTypeCode: TypeCode | null): string[] {
  const shuffled = [...TOPICS[resolveTopicKey(gallery, myTypeCode)]]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, TOPIC_COUNT)
}
