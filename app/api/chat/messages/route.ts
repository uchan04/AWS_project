import type { NextRequest } from "next/server"
import { getCurrentUser, getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import {
  grantAffinity,
  chatAffinityToday,
  CHAT_TURN_AFFINITY,
  AFFINITY_CAP_BY_SOURCE,
} from "@/app/community/_lib/affinity"
import { completeMissionByCode } from "@/lib/missions/completion"

export async function GET() {
  try {
    const user = await getCurrentUser()

    // 최근 50개만 노출한다. desc + take로 최신 50개를 뽑은 뒤 표시 순서(오름차순)로 뒤집는다 —
    // asc + take만 쓰면 대화가 길어졌을 때 항상 "가장 오래된" 50개만 보여 최근 대화가 안 보인다.
    const recent = await prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    // 패널이 전역 오버레이가 되면서 서버 컴포넌트가 props를 넘겨줄 자리가 없어졌다.
    // 화면에 필요한 값을 이 GET 하나로 같이 내린다(요청 횟수는 그대로다).
    // BEDROCK_MODEL_ID 값 자체는 내보내지 않는다 — 설정 여부(boolean)만 내린다.
    return ok({
      messages: recent.reverse(),
      affinityToday: user.affinityToday,
      // 챗봇 게이지는 총 친밀도가 아니라 **챗봇 몫**을 보여준다(상한 40).
      // 총합을 보여주면 커뮤니티에서 받은 양까지 섞여 "챗봇으로 얼마 더 받을 수 있나"를 못 읽는다.
      chatAffinityToday: await chatAffinityToday(user.id),
      chatAffinityCap: AFFINITY_CAP_BY_SOURCE.CHAT,
      nickname: user.nickname,
      typeCode: user.typeCode,
      bedrockConfigured: Boolean(process.env.BEDROCK_MODEL_ID),
    })
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

    // 챗봇 상한(40)을 재려면 **이 턴을 넣기 전** 누계가 필요하다. 만든 뒤에 세면
    // 방금 만든 1턴이 포함돼 8턴째에 이미 40으로 읽히고 그 턴이 0을 받는다.
    const beforeThisTurn = await chatAffinityToday(user.id)

    const message = await prisma.chatMessage.create({
      data: { userId: user.id, role: "USER", content },
    })

    // 친밀도는 사용자가 메시지를 보낸 이 시점에만 지급한다 — Bedrock 응답 저장 시점
    // (/api/chat/stream)에서 다시 지급하지 않는다(1턴 = 사용자 발화 기준, 중복 지급 금지).
    const granted = await grantAffinity(user, CHAT_TURN_AFFINITY, "CHAT")

    // 미션 완료는 본 동작이 끝난 뒤에 별도 try/catch로 부른다.
    // 트랜잭션에 넣지 않는다 — 미션 실패가 메시지 저장을 롤백시키면 안 된다.
    // 중복 완료는 completeMission 내부에서 P2002를 잡아 newlyCompleted:false로 돌려준다.
    // 사용자 발화 저장 시점에만 호출한다. Bedrock 응답 저장 자리(/api/chat/stream)에서
    // 또 부르면 중복이다.
    try {
      await completeMissionByCode({ actor: user, code: "DAILY_CHAT" })
    } catch (error) {
      console.error("[DAILY_CHAT] 미션 완료 처리 실패", error)
    }

    return ok({ message, granted, chatAffinityToday: beforeThisTurn + granted })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
