import type { GalleryType } from "@prisma/client"

/**
 * 커뮤니티 메인 희망 문구. SPEC.md 9절: 상수로 하드코딩하고 주 1회 단위로만 교체한다.
 * 문구는 한 줄짜리 문장이며 서브 문구는 두지 않는다.
 *
 * ## 문구를 고칠 때의 톤 규칙
 * 유형명을 절대 쓰지 않는다 / 조언("~해보세요") 금지 / 증상에 이름 붙이지 않는다 /
 * 과장된 칭찬 금지. `app/chat/_lib/systemPrompt.ts`의 PERSONA와 같은 기준이다.
 */
export const HOPE_MESSAGES: Record<GalleryType, readonly string[]> = {
  ALL: [
    "오늘 하루도 여기 있어줘서 고마워요.",
    "여기선 아무 말이나 해도 괜찮아요.",
    "짧게 쓴 글도 글이에요.",
    "힘든 날엔 쉬어도 돼요.",
    "서로 다른 하루가 여기 모여 있어요.",
  ],
  HEALTH_EMOTION: [
    "아무것도 하지 않은 하루도 하루예요.",
    "오늘 일어났다면 그걸로 됐어요.",
    "천천히 가도 늦는 게 아니에요.",
    "몸이 무거운 날엔 무거운 채로 있어도 돼요.",
    "나아지는 속도는 정하지 않아도 괜찮아요.",
  ],
  INDEPENDENT_LOW_INCOME: [
    "혼자 지나온 시간이 짧지 않았을 거예요.",
    "조용한 하루가 나쁜 하루는 아니에요.",
    "오늘 챙긴 한 끼면 충분해요.",
    "버티는 것도 하루를 지나는 방법이에요.",
    "여기 잠깐 들르는 것만으로도 괜찮아요.",
  ],
  FAMILY_LIVING: [
    "같이 있어도 혼자인 것 같은 날이 있어요.",
    "방문을 닫는 시간도 필요해요.",
    "말하지 않은 마음도 마음이에요.",
    "편한 척하지 않아도 괜찮아요.",
    "여기선 조용히 있어도 돼요.",
  ],
}

const WEEK_MS = 604_800_000

/**
 * 이번 주 해당 갤러리의 문구를 고른다.
 *
 * epoch(1970-01-01, 목요일)부터 흐른 주 수로 나누므로 교체 시점은 매주 목요일 09:00 KST
 * (목요일 00:00 UTC)다. 요일을 옮기려면 나누기 전에 오프셋을 더해야 한다.
 *
 * 주차는 갤러리와 무관하게 한 번만 계산한다. 지금은 네 배열의 길이가 전부 5라
 * 네 갤러리의 문구가 같은 주에 함께 넘어간다. 어느 한 배열의 길이를 바꾸면
 * 그 갤러리만 다른 주기로 돌게 되므로, 길이는 넷을 같이 움직인다.
 *
 * Math.random()을 쓰지 않는 이유: 서버 렌더마다 문구가 달라져 새로고침할 때마다 바뀐다.
 * 시간·분 단위 교체도 하지 않는다 — 자주 바뀌면 사용자가 피로해진다(SPEC.md 9절).
 */
export function pickHopeMessage(gallery: GalleryType, now: Date = new Date()): string {
  const week = Math.floor(now.getTime() / WEEK_MS)
  const messages = HOPE_MESSAGES[gallery]
  return messages[week % messages.length]
}
