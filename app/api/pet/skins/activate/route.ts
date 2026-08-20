import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUser } from "@/lib/auth"
import { cappedStage } from "@/lib/pet"
import { prisma } from "@/lib/prisma"

// 소유자: C. 활성 캐릭터 전환. (SPEC.md 5절)
//
// 재화가 오가지 않는다. 레벨·경험치는 유저에게 붙어 있으므로 전환해도 진행도가 남는다.
//
// 진화 단계만 다시 계산한다. 친밀도 캐릭터는 stageCount = 1이라 3단 펫에서 갈아타면
// 저장된 evolutionStage(2·3)가 새 캐릭터의 단계 수를 넘는다. 화면·GET은 레벨에서 다시
// 계산하므로 표시가 깨지지는 않지만, 저장값을 방치하면 DB만 보는 사람이 틀린 값을 읽는다.

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_BODY", "요청 형식이 잘못되었습니다")
    }

    const skinId = (body as { skinId?: unknown })?.skinId
    if (typeof skinId !== "string" || skinId.length === 0) {
      return fail("INVALID_SKIN", "전환할 캐릭터를 지정해 주세요")
    }

    // 가지고 있지 않은 캐릭터로는 전환할 수 없다
    const mine = await prisma.userPetSkin.findUnique({
      where: { userId_petSkinId: { userId: user.id, petSkinId: skinId } },
      include: { petSkin: { select: { name: true, stageCount: true } } },
    })
    if (!mine) return fail("NOT_OWNED", "아직 가지고 있지 않은 캐릭터입니다", 404)

    const evolutionStage = cappedStage(user.level, mine.petSkin.stageCount)

    await prisma.user.update({
      where: { id: user.id },
      data: { activePetSkinId: skinId, evolutionStage },
    })

    return ok({
      activeSkinId: skinId,
      name: mine.petSkin.name,
      stageCount: mine.petSkin.stageCount,
      evolutionStage,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[POST /api/pet/skins/activate]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
