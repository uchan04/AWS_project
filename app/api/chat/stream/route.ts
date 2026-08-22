import { BedrockRuntimeClient, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime"
import { getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { fail } from "@/lib/api"
import { buildSystemPrompt } from "@/app/chat/_lib/systemPrompt"

// 최근 대화 이력만 Bedrock에 보낸다. 전체를 매번 보내면 토큰 비용이 누적된다.
const HISTORY_LIMIT = 20

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1",
})

// 사용자 발화 저장(app/api/chat/messages)이 끝난 뒤 클라이언트가 이어서 호출한다.
// 이 라우트는 메시지를 저장하지도, 친밀도를 지급하지도 않는다 — 어시스턴트 응답 생성·저장만 한다.
export async function POST() {
  try {
    const user = await getCurrentUserWithSkin()

    if (!user.typeCode) {
      return fail("NO_TYPE_CODE", "진단을 먼저 완료해주세요", 400)
    }

    if (!process.env.BEDROCK_MODEL_ID) {
      return fail("BEDROCK_NOT_CONFIGURED", "AI 응답이 아직 연결되지 않았어요", 500)
    }

    const recent = await prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    })
    const history = recent.reverse()

    if (history.length === 0 || history[history.length - 1].role !== "USER") {
      return fail("INVALID_STATE", "먼저 메시지를 보내주세요", 400)
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
