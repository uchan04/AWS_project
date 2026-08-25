import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { claimOuting } from "@/lib/outing"

// 소유자: C. 돌아온 펫의 이야기를 듣고 재화를 받는다. (SPEC.md 5절)
//
// 이쪽은 "획득"이므로 지급이 calculateReward()를 통과한다 — 실제 통과 지점은
// lib/outing.ts claimOuting()이다. 저장된 gotSeeds·gotShards는 배율 적용 **전** 값이라
// 실지급과 다를 수 있고, 화면은 응답의 gained를 보여준다.
//
// 낙관적 갱신을 하지 않는다: 클라이언트는 랜덤으로 뽑힌 값을 모른다.

export async function POST() {
  try {
    const user = await getCurrentUserWithSkin()

    const result = await claimOuting({ userId: user.id, skin: user.activePetSkin }, new Date())

    if (!result.ok) {
      return fail(result.code, result.message, result.code === "NO_TABLE" ? 500 : 400)
    }

    return ok(result)
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[POST /api/pet/outing/claim]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
