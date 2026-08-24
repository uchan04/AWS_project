import { ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime"
import { getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { STREAM_TIMEOUT_MS, bedrockClient } from "@/lib/bedrock"
import { prisma } from "@/lib/prisma"
import { fail } from "@/lib/api"
import { buildSystemPrompt } from "@/app/chat/_lib/systemPrompt"
import { isCrisis, CRISIS_REPLY } from "@/lib/safety"

// 최근 대화 이력만 Bedrock에 보낸다. 전체를 매번 보내면 토큰 비용이 누적된다.
const HISTORY_LIMIT = 20

// 타임아웃·재시도 설정은 lib/bedrock.ts에 있다. 스트리밍은 청크 사이 유휴 기준이라 넉넉하다
const client = bedrockClient(STREAM_TIMEOUT_MS)

// 사용자 발화 저장(app/api/chat/messages)이 끝난 뒤 클라이언트가 이어서 호출한다.
// 이 라우트는 메시지를 저장하지도, 친밀도를 지급하지도 않는다 — 어시스턴트 응답 생성·저장만 한다.
export async function POST() {
  try {
    const user = await getCurrentUserWithSkin()

    if (!user.typeCode) {
      return fail("NO_TYPE_CODE", "진단을 먼저 완료해주세요", 400)
    }

    const recent = await prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    })
    const history = recent.reverse()

    const lastMessage = history[history.length - 1]
    if (!lastMessage || lastMessage.role !== "USER") {
      return fail("INVALID_STATE", "먼저 메시지를 보내주세요", 400)
    }

    // 위기 신호는 Bedrock을 부르기 전에, 모델에 맡기지 않고 여기서 처리한다.
    //
    // 이 블록이 BEDROCK_MODEL_ID 검사보다 위에 있는 것이 핵심이다. 아래로 내리면
    // Bedrock이 설정되지 않은 환경에서 자해 신호에 "AI 응답이 아직 연결되지 않았어요"가
    // 나간다. 위기 대응은 LLM 가용성과 무관해야 한다(lib/safety.ts 참고).
    //
    // 응답은 스트림이 아니라 완성된 본문 한 번이다. 클라이언트는 res.body를 그대로
    // 읽으므로 코드 변경 없이 한 청크로 받는다. 고정 문구를 한 글자씩 흘려보낼 이유가 없다.
    if (isCrisis(lastMessage.content)) {
      // 이력에 남긴다 — 다음 턴에 모델이 이 흐름을 보고 이어서 말할 수 있어야 한다.
      // 저장이 실패해도 응답은 반드시 내보낸다(화면에 안내가 뜨는 것이 이력보다 우선).
      try {
        await prisma.chatMessage.create({
          data: { userId: user.id, role: "ASSISTANT", content: CRISIS_REPLY },
        })
      } catch (error) {
        console.error("위기 응답 저장 실패", error)
      }
      return new Response(CRISIS_REPLY, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          // 화면이 전화 걸기 카드를 띄우는 신호. 본문 문자열을 파싱하게 하지 않는다
          "X-Crisis": "1",
        },
      })
    }

    if (!process.env.BEDROCK_MODEL_ID) {
      return fail("BEDROCK_NOT_CONFIGURED", "AI 응답이 아직 연결되지 않았어요", 500)
    }

    const command = new ConverseStreamCommand({
      modelId: process.env.BEDROCK_MODEL_ID,
      system: [{ text: buildSystemPrompt(user.typeCode, user.nickname) }],
      messages: history.map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: [{ text: m.content }],
      })),
    })

    let bedrockStream
    try {
      const response = await client.send(command)
      bedrockStream = response.stream
    } catch (error) {
      console.error("Bedrock 호출 실패", error)
      return fail("BEDROCK_ERROR", "AI 응답을 가져오지 못했어요", 500)
    }

    if (!bedrockStream) {
      return fail("BEDROCK_ERROR", "AI 응답을 가져오지 못했어요", 500)
    }

    const encoder = new TextEncoder()
    const userId = user.id

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let full = ""
        let completed = false
        try {
          for await (const event of bedrockStream) {
            const delta = event.contentBlockDelta?.delta?.text
            if (delta) {
              full += delta
              controller.enqueue(encoder.encode(delta))
            }
            if (event.messageStop) {
              completed = true
            }
          }
        } catch (error) {
          console.error("Bedrock 스트림 오류", error)
        } finally {
          // 스트림이 끝까지 정상 종료된 경우에만 저장한다. 중간에 끊긴 응답을 저장하면
          // 잘린 문장이 다음 요청의 대화 이력에 섞여 모델이 이상하게 반응한다.
          if (completed && full.trim()) {
            try {
              await prisma.chatMessage.create({
                data: { userId, role: "ASSISTANT", content: full },
              })
            } catch (error) {
              console.error("어시스턴트 메시지 저장 실패", error)
            }
          }
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
