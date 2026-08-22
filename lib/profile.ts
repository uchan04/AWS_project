import type { TypeCode } from "@prisma/client"
import { unstable_rethrow } from "next/navigation"
import { petImageUrl } from "@/lib/assets"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { cappedStage } from "@/lib/pet"

// 소유자: A. 사이드바·챗봇 버튼이 쓰는 프로필. 서버에서 한 번 읽어 props로 내려준다.
//
// 전에는 Sidebar가 /api/pet + /api/diagnosis/me를, ChatLauncher가 /api/diagnosis/me를
// 각자 fetch했다. 세 호출이 usePathname deps에 묶여 탭을 옮길 때마다 다시 나갔다 —
// 탭 이동 5회에 HTTP 요청 14건이 잡혔다(2026-08-21 실측).
// Amplify가 us-east-1이라 한국에서 요청 1건이 178ms다. DB 쿼리보다 HTTP 왕복이 비싸다.
// 루트 레이아웃은 클라이언트 이동 시 재렌더되지 않으므로, 여기서 한 번 읽으면
// 이후 탭 이동은 추가 요청이 0이다.

export type SidebarProfile = {
  nickname: string
  typeCode: TypeCode | null
  seeds: number
  affinity: number
  starShards: number
  level: number
  createdAt: string
  imageUrl: string | null
  /** 진단을 마쳤는지. 챗봇 버튼은 진단 전에 뜨면 안 된다 */
  diagnosed: boolean
}

/** 미인증이거나 읽기에 실패하면 null. 호출부는 사이드바를 아예 그리지 않는다. */
export async function getSidebarProfile(): Promise<SidebarProfile | null> {
  try {
    const user = await getCurrentUserWithSkin()
    const skin = user.activePetSkin
    // 기본값 4는 prisma/seed/items.ts의 stageCount와 같다. 3을 쓰면 성체 그림이 안 뜬다
    const stage = cappedStage(user.level, skin?.stageCount ?? 4)

    return {
      nickname: user.nickname || "익명",
      typeCode: user.typeCode,
      seeds: user.seeds,
      affinity: user.affinity,
      starShards: user.starShards,
      level: user.level,
      createdAt: user.createdAt.toISOString(),
      imageUrl: skin ? petImageUrl(skin.imageKeyBase, stage) : null,
      diagnosed: Boolean(user.typeCode && user.adjective),
    }
  } catch (error) {
    // cookies()는 정적 렌더 시도 중에 Next 내부 에러를 던진다. 그걸 여기서 삼키면
    // Next가 정적 렌더를 포기하지 못하고 빌드 로그가 에러로 뒤덮인다 —
    // unstable_rethrow가 프레임워크 에러만 다시 던진다(next/navigation).
    unstable_rethrow(error)
    if (error instanceof UnauthorizedError) return null
    // DB가 죽어도 화면 전체를 죽이지 않는다. 사이드바만 빠진다
    console.error("[getSidebarProfile]", error)
    return null
  }
}
