import type { NextRequest } from "next/server"
import { getCurrentUser, getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { grantAffinity, CHAT_TURN_AFFINITY } from "@/app/community/_lib/affinity"
import { buildSystemPrompt } from "@/app/chat/_lib/systemPrompt"

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()

    // 최근 50개만 노출한다. desc + take로 최신 50개를 뽑은 뒤 표시 순서(오름차순)로 뒤집는다 —
    // asc + take만 쓰면 대화가 길어졌을 때 항상 "가장 오래된" 50개만 보여 최근 대화가 안 보인다.
    const recent = await prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return ok({ messages: recent.reverse() })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}

// 친밀도를 지급하는 라우트라 getCurrentUserWithSkin()을 쓴다.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserWithSkin()

    if (!user.typeCode) {
      return fail("NO_TYPE_CODE", "진단을 먼저 완료해주세요", 400)
    }

    const payload = await request.json().catch(() => null)
    const content = typeof payload?.content === "string" ? payload.content.trim() : ""
    if (!content) return fail("INVALID_BODY", "메시지를 입력해주세요", 400)

    const message = await prisma.chatMessage.create({
      data: { userId: user.id, role: "USER", content },
    })

    const systemPrompt = buildSystemPrompt(user.typeCode, user.nickname)
    // TODO: Bedrock 호출 — app/chat/_lib/systemPrompt.ts의 systemPrompt와 대화 이력으로
    // 스트리밍 응답을 생성하고 ChatRole.ASSISTANT로 저장한다. BEDROCK_MODEL_ID 확보 후 구현 (SPEC.md 7절).
    // 친밀도는 사용자가 메시지를 보낸 이 시점에 이미 지급한다 — Bedrock 응답 저장 시점에
    // 다시 지급하지 않는다(1턴 = 사용자 발화 기준, 중복 지급 금지).
    void systemPrompt

    const granted = await grantAffinity(user, CHAT_TURN_AFFINITY)

    return ok({ message, granted })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
