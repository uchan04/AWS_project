import { fail, ok } from "@/lib/api"
import { UnauthorizedError, getCurrentUserWithSkin } from "@/lib/auth"
import { OUTING_HISTORY_LIMIT, listOutingHistory } from "@/lib/outing"

// 소유자: C. 여행일기 보관함 — 이미 수령한 외출 최근 10건. (SPEC.md 5절)
//
// **읽기 전용이다.** 재화를 주지도 받지도 않는다 — 수령은 `POST /claim` 하나뿐이고,
// 여기서 지급 경로를 하나 더 만들면 `calculateReward()`를 통과하는 지점이 둘이 된다.
//
// 아직 안 받은 건은 목록에 없다(`listOutingHistory`의 `claimedAt: { not: null }`).
// 그 건은 방의 외출 버튼이 `이야기 듣기`로 들고 있고, 보관함에서 먼저 읽히면
// 누르기 전에 다 보여 주는 것이 된다.
//
// `getCurrentUserWithSkin`을 쓰는 이유는 재화에 스킨 배율을 얹기 때문이다 —
// 수령 당시 화면이 보여 준 숫자와 보관함의 숫자가 어긋나면 기록으로서 값을 잃는다.
//
// GET을 화면 진입에서 부르지 않는다. 보관함 모달을 **열 때** 부른다 — `/pet`이 이미
// 가장 무거운 화면이고(왕복 하나가 약 180ms), 이 목록은 열지 않으면 안 쓰는 값이다.

export async function GET() {
  try {
    const user = await getCurrentUserWithSkin()

    const items = await listOutingHistory(user.id, user.activePetSkin)

    return ok({ items, limit: OUTING_HISTORY_LIMIT })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    console.error("[GET /api/pet/outing/history]", error)
    return fail("INTERNAL", "잠시 후 다시 시도해 주세요", 500)
  }
}
