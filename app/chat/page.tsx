// 개발 확인용 라우트. 최종 형태는 layout.tsx의 전역 오버레이 패널이며 E와 조율 후 이전한다.
import { getCurrentUser } from "@/lib/auth"
import { ChatPanel } from "./_components/ChatPanel"

// 유저별 인증 정보를 매 요청마다 다시 읽어야 한다. searchParams 같은 동적 신호가 없어서
// 그냥 두면 빌드 시점에 정적 페이지로 캐시돼(당시 dev 유저 스냅샷이 굳어버림) 매 요청마다
// 최신 로그인 유저를 반영하지 못한다.
export const dynamic = "force-dynamic"

export default async function ChatPage() {
  const user = await getCurrentUser()

  return (
    <ChatPanel
      nickname={user.nickname}
      typeCode={user.typeCode}
      bedrockConfigured={Boolean(process.env.BEDROCK_MODEL_ID)}
    />
  )
}
