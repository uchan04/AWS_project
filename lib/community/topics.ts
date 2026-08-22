// 커뮤니티 글쓰기 주제·초안 추천. SPEC.md 8절 "글쓰기 창 진입 시 LLM이 사용자 성향에
// 맞는 작성 주제·초안을 3가지 이상 추천"의 구현이다.
//
// 전에는 app/community/_lib/topics.ts의 고정 문구 6개 중 3개를 무작위로 뽑았다.
// 그 파일은 지금도 남아 있다 — 이 호출이 실패했을 때 글쓰기 창이 빈 채로 뜨지 않게 하는
// 대비책이다. 추천이 없어도 글은 쓸 수 있어야 하므로 실패를 화면 오류로 만들지 않는다.
//
// 프롬프트 구성은 lib/diagnosis/reason.ts와 같은 방식이다: Tool을 강제해 형식을 고정하고,
// 낙인 단어는 모델의 선의에 맡기지 않고 출력에서 직접 걸러낸다.

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import type { TypeCode } from "@prisma/client"
import { BANNED } from "@/lib/diagnosis/reason"
import { TRIBE } from "@/lib/types"

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || "us-east-1" })

export type SuggestedTopic = { title: string; draft: string }

export const TOPIC_COUNT = 3
const TITLE_MAX = 20
const DRAFT_MAX = 90

// 종족별로 무엇을 겪고 있는 사람인지 한 줄로만 알려준다. 유형명·지표명은 넣지 않는다
// (SPEC 2절: 내부 유형명은 어떤 출력에도 나오지 않는다). 모델에게 주는 것은
// "이 사람의 하루가 어떤 결인지"뿐이고, 그마저 판단이 아니라 배경 설명이다.
const CONTEXT: Record<TypeCode, string> = {
  INDEPENDENT_LOW_INCOME: "혼자 지내며 살림과 끼니를 스스로 챙긴다. 하루가 조용하고 방 안에서 보내는 시간이 길다.",
  HEALTH_EMOTION: "몸과 마음이 무거워 하루가 느리게 간다. 일어나는 것, 씻는 것 하나가 큰 일이 되는 날이 있다.",
  FAMILY_LIVING: "가족과 한집에 살지만 방 안에 머문다. 마주치는 것이 편치 않아 시간을 피해 움직인다.",
}

const SYSTEM_PROMPT = `너는 조용한 커뮤니티의 글쓰기 창에 띄울 "오늘 이런 걸 써볼까요" 추천을 만든다.

주제 ${TOPIC_COUNT}개를 쓴다. 각 주제는 제목 하나와 초안 한두 문장으로 이뤄진다.
초안은 사용자가 그대로 올려도 되고, 고쳐 써도 되는 시작 문장이다.

규칙:
1. 소재는 방 안에서 일어난 아주 작은 일이다. 창밖, 끼니, 소리, 잠, 씻기, 미뤄둔 일 같은 것.
2. 성취·극복·노력을 요구하지 않는다. "해냈다", "이겨냈다", "용기를 냈다" 같은 말을 쓰지 않는다.
3. 진단·조언·격려를 하지 않는다. 아무것도 안 한 하루도 쓸 것이 있는 하루로 둔다.
4. 사람을 만나거나 밖에 나가는 것을 전제하지 않는다. 오늘 방에서 나가지 않은 사람도 쓸 수 있어야 한다.
5. 초안은 반말 일기체로 쓴다("~했다", "~였다"). 남에게 말을 거는 문장이 아니다.
6. 제목은 ${TITLE_MAX}자 이내, 초안은 ${DRAFT_MAX}자 이내.
7. 진단명·유형명·분류를 쓰지 않는다. 소득·빈곤·우울·질병·부채·고립·은둔·실업을 가리키는 단어를 쓰지 않는다.
8. ${TOPIC_COUNT}개는 서로 다른 소재여야 한다. 같은 소재를 표현만 바꿔 늘리지 않는다.
9. 결과는 반드시 submit_topics Tool로 제출한다.

좋은 예: 제목 "오늘 창밖 풍경" / 초안 "커튼을 열었더니 밖이 생각보다 밝았다. 잠깐 그대로 서 있었다."
나쁜 예: 제목 "작은 성취 기록하기" / 초안 "오늘 해낸 일을 적어보자." (성취를 요구하고, 일기가 아니라 지시다)`

const TOPICS_TOOL = {
  toolSpec: {
    name: "submit_topics",
    description: `글쓰기 창에 띄울 주제 ${TOPIC_COUNT}개를 제출합니다`,
    inputSchema: {
      json: {
        type: "object",
        properties: {
          topics: {
            type: "array",
            minItems: TOPIC_COUNT,
            maxItems: TOPIC_COUNT,
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: `주제 제목. ${TITLE_MAX}자 이내` },
                draft: { type: "string", description: `초안 한두 문장. ${DRAFT_MAX}자 이내` },
              },
              required: ["title", "draft"],
            },
          },
        },
        required: ["topics"],
      },
    },
  },
}

/**
 * 모델 출력 검사. AWS 없이 돌 수 있도록 순수 함수로 떼어 뒀다.
 * 통과하지 못하면 throw한다 — 호출부가 고정 문구로 되돌아간다.
 */
export function validateTopics(raw: unknown): SuggestedTopic[] {
  if (!Array.isArray(raw) || raw.length !== TOPIC_COUNT) throw new Error("주제 개수가 맞지 않습니다")

  const topics = raw.map((item) => {
    const title = typeof (item as SuggestedTopic)?.title === "string" ? (item as SuggestedTopic).title.trim() : ""
    const draft = typeof (item as SuggestedTopic)?.draft === "string" ? (item as SuggestedTopic).draft.trim() : ""
    return { title, draft }
  })

  if (topics.some((t) => t.title.length === 0 || t.title.length > TITLE_MAX)) {
    throw new Error("주제 제목 길이가 범위를 벗어났습니다")
  }
  if (topics.some((t) => t.draft.length === 0 || t.draft.length > DRAFT_MAX)) {
    throw new Error("주제 초안 길이가 범위를 벗어났습니다")
  }

  // 제목이 겹치면 화면에서 같은 것이 두 번 보인다(React key도 겹친다)
  if (new Set(topics.map((t) => t.title)).size !== topics.length) {
    throw new Error("주제 제목이 중복됩니다")
  }

  const hit = BANNED.find((word) => topics.some((t) => t.title.includes(word) || t.draft.includes(word)))
  if (hit) throw new Error(`주제 문구에 쓸 수 없는 단어가 있습니다: ${hit}`)

  return topics
}

/**
 * 주제 3개. 실패하면 throw한다 — 호출부가 고정 문구로 되돌아간다.
 * BEDROCK_MODEL_ID가 비어 있으면 호출도 하지 않는다.
 */
export async function suggestTopics(typeCode: TypeCode): Promise<SuggestedTopic[]> {
  const modelId = process.env.BEDROCK_MODEL_ID
  if (!modelId) throw new Error("BEDROCK_MODEL_ID가 설정되지 않았습니다")

  const tribe = TRIBE[typeCode]

  const response = await bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `이 사용자는 "${tribe.family} · ${tribe.animal}" 갤러리에서 글을 쓰려고 합니다.\n\n이 사람의 하루: ${CONTEXT[typeCode]}\n\n주제 ${TOPIC_COUNT}개를 만들어 주세요.`,
            },
          ],
        },
      ],
      toolConfig: { tools: [TOPICS_TOOL], toolChoice: { tool: { name: "submit_topics" } } },
      // temperature를 넣지 않는다 — Claude Sonnet 5가 이 값을 거부한다(reason.ts와 같은 이유).
      // 매번 다른 주제가 나오길 바라지만 온도로는 조절할 수 없고, 규칙 1의 소재가 넓어서
      // 실제로도 호출마다 달라진다
      inferenceConfig: { maxTokens: 1024 },
    }),
  )

  const toolUse = response.output?.message?.content?.find((c) => c.toolUse)?.toolUse
  if (toolUse?.name !== "submit_topics") throw new Error("submit_topics Tool이 호출되지 않았습니다")

  return validateTopics((toolUse.input as { topics?: unknown })?.topics)
}
