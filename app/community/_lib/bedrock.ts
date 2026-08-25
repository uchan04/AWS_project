// 커뮤니티 검열(_lib/moderation.ts)이 쓰는 Bedrock 단발 호출 래퍼.
//
// `app/chat/_lib`에는 재사용할 헬퍼가 없다 — 거기 있는 것은 `bubbles.ts`·`starters.ts`·
// `systemPrompt.ts` 세 개뿐이고, 실제 호출은 `app/api/chat/stream/route.ts`가 직접 한다.
// 그쪽은 `ConverseStreamCommand`(스트리밍)라 검열에 쓸 수 없다. 그래서 여기에 얇게 만든다.
//
// 호출 형태는 `lib/community/topics.ts`(단발 호출의 기존 사례)를 그대로 따랐다.

import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import { bedrockClient } from "@/lib/bedrock"

/**
 * 무응답 상한. **`lib/bedrock.ts`의 `ONESHOT_TIMEOUT_MS`(20초)를 쓰지 않는다.**
 *
 * 그 값은 글쓰기 창을 여는 길목(주제 추천)이나 사진 판정처럼 사용자가 기다릴 각오가 된
 * 자리를 위한 것이다. 검열은 **글·댓글을 저장하기 직전**에 끼어들므로, 여기가 20초면
 * Bedrock이 느린 날 "올리기"를 누른 사람이 20초 동안 아무것도 못 한다.
 *
 * 3초를 넘기면 던진다. `moderate()`가 삼키는 쪽이라 글은 그대로 올라간다.
 */
const MODERATION_TIMEOUT_MS = 3000

/**
 * 재시도를 하지 않는다(SDK 기본 3, `bedrockClient` 기본 2).
 *
 * 상한을 3초로 낮춘 이유가 쓰기 경로를 멈추지 않는 것인데, 2회 시도면 백오프까지 더해
 * 최악의 대기가 6초를 넘어 그 의도가 사라진다. 검열은 실패해도 글이 올라가는 쪽이라
 * (`containsAbuse()` 정규식이 앞에 남아 있다) 재시도로 살릴 이득이 대기 시간보다 작다.
 */
const MODERATION_MAX_ATTEMPTS = 1

const bedrock = bedrockClient(MODERATION_TIMEOUT_MS, MODERATION_MAX_ATTEMPTS)

/**
 * system·user 두 문장을 넣고 모델이 낸 텍스트를 그대로 돌려준다.
 *
 * 실패하면 던진다 — `BEDROCK_MODEL_ID`가 비었을 때, 타임아웃, 자격증명 오류 모두.
 * 판정(무엇을 막을지)은 이 파일이 하지 않는다. 호출부(`moderation.ts`)의 몫이다.
 */
export async function invokeBedrock(system: string, user: string): Promise<string> {
  const modelId = process.env.BEDROCK_MODEL_ID
  if (!modelId) throw new Error("BEDROCK_MODEL_ID가 설정되지 않았습니다")

  const response = await bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      // temperature를 넣지 않는다 — Claude Sonnet 5가 이 값을 거부한다
      // (`lib/community/topics.ts`·`lib/diagnosis/reason.ts`가 같은 이유로 뺐다).
      //
      // maxTokens는 짧게 잡는다. 검열 응답은 판정 한 덩어리라 길 이유가 없고,
      // 길게 열어두면 생성 시간이 위 3초 상한을 그냥 먹는다.
      inferenceConfig: { maxTokens: 512 },
    }),
  )

  // content는 블록 배열이다. text 블록만 이어 붙인다
  return (response.output?.message?.content ?? [])
    .map((block) => block.text ?? "")
    .join("")
    .trim()
}
