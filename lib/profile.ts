import type { TypeCode } from "@prisma/client"
import { unstable_rethrow } from "next/navigation"
import { avatarUrl, petImageUrl } from "@/lib/assets"
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
  /** 펫 그림(성장 단계 반영). 쉼 화면 `/pet/rest`이 이 값으로 펫을 그린다 */
  imageUrl: string | null
  /**
   * 프로필 원형 전용 종족 아바타 (2026-08-24 추가).
   *
   * imageUrl과 따로 두는 이유: 같은 profile을 쉼 화면(`app/pet/rest/page.tsx`)도 받아
   * 방 안의 **펫**을 그린다. imageUrl을 아바타로 바꿔 버리면 그 화면의 펫이 프로필
   * 사진으로 뒤바뀐다. 바꾸기로 정한 것은 원형 아바타 3곳뿐이다(사이드바 펼침·접힘·모달).
   *
   * 값이 없는 스킨이면 null이고, 사이드바가 imageUrl로 되돌아간다.
   */
  avatarUrl: string | null
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
      avatarUrl: avatarUrl(skin?.avatarKey),
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
