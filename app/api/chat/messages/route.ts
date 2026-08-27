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

// 유저당 보관하는 대화 메시지 상한. 화면 노출 50·모델 주입 50의 4배 여유이며,
// 200개를 넘는 구간은 사용자가 화면에서 볼 수단 자체가 없다.
//
// 하드 삭제인 이유: 커뮤니티(Post·Comment)의 소프트 삭제는 친밀도 파밍 차단이
// 목적이라 행을 남겨야 하지만, 여기는 보관 최소화가 목적이라 deletedAt만 찍으면
// 아무 의미가 없다. 고립·은둔 청년이 털어놓은 감정 대화를 아무도 열람하지 않는
// 채로 무한히 쌓아두지 않는다.
//
// 삭제해도 친밀도가 깨지지 않는 것은 확인했다 — 챗봇 몫은 User.affinityTodayChat에
// 집계되고 메시지 수를 세지 않는다(아래 POST 주석 참고). 메시지 수로 유도하던
// 예전 구현이었다면 이력 삭제가 곧 무한 파밍 구멍이었다.
const MESSAGE_RETENTION = 200

/**
 * 유저의 대화 메시지를 최근 MESSAGE_RETENTION개로 줄인다.
 *
 * 배치가 아니라 요청 시점에 정리하는 이유: SPEC 10절 "채택하지 않은 것"에
 * EventBridge·Lambda가 있어 주기 실행을 붙일 자리가 없다.
 *
 * count()를 먼저 부르지 않는다. skip으로 200번째 최신 메시지를 직접 찾아
 * 없으면(=200개 미만) 쿼리 1번으로 끝난다.
 */
async function trimHistory(userId: string) {
  const boundary = await prisma.chatMessage.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: MESSAGE_RETENTION - 1,
    select: { createdAt: true },
  })
  if (!boundary) return

  // createdAt이 같은 행이 있으면 함께 남는다. 상한을 살짝 넘기는 쪽이
  // 덜 지우는 실패라 안전한 방향이다.
  await prisma.chatMessage.deleteMany({
    where: { userId, createdAt: { lt: boundary.createdAt } },
  })
}

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

    // 챗봇 몫은 `User.affinityTodayChat`에 있고 grantAffinity()가 그 컬럼을 읽는다.
    // 메시지 수로 유도하던 시절에는 이 턴을 넣기 **전** 누계를 따로 재야 했다 —
    // 컬럼이 생겨서 그 계산이 필요 없어졌다(affinity.ts todayBySource 주석)
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

    // 본 동작이 끝난 뒤 곁다리로 정리한다. 트랜잭션에 넣지 않고 별도 try/catch로
    // 감싼다 — 정리 실패가 메시지 저장을 롤백시키면 안 된다(위 미션 블록과 같은 이유).
    try {
      await trimHistory(user.id)
    } catch (error) {
      console.error("대화 이력 정리 실패", error)
    }

    return ok({ message, granted, chatAffinityToday: await chatAffinityToday(user.id) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
