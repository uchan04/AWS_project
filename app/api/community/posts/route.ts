import type { NextRequest } from "next/server"
import { getCurrentUser, getCurrentUserWithSkin, UnauthorizedError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok, fail } from "@/lib/api"
import { GalleryType } from "@prisma/client"
import { resolveGallery, canAccessGallery, listGalleryPosts } from "@/app/community/_lib/gallery"
import { TITLE_MAX, BODY_MAX, IMAGE_KEY_MAX } from "@/app/community/_lib/limits"
import { isAttachableImageKey } from "@/app/community/_lib/imageKey"
import { grantAffinity, POST_AFFINITY } from "@/app/community/_lib/affinity"
import { completeMissionByCode } from "@/lib/missions/completion"
import { recordAttempt, retryAfter } from "@/lib/ratelimit"
import { containsAbuse, isCrisis, CRISIS_POST_NOTICE } from "@/lib/safety"
import { blocksPosting, crisisBlockedPayload } from "@/app/community/_lib/crisis"
import { moderateImage, ImageModerationError } from "@/app/community/_lib/imageModeration"
import { moderate, BLOCK_CODE } from "@/app/community/_lib/moderation"
import { invokeBedrock } from "@/app/community/_lib/bedrock"

// 도배 방어. 로그인 라우트는 IP로 세지만(clientKey) 여기는 인증된 뒤라 userId로 센다 —
// IP는 위조되고 공유 회선이면 남까지 막힌다. 글은 한 번 쓰는 데 몇 분이 걸리는 행동이라
// 10분에 5건이면 정상 사용자가 닿지 않는다.
const POST_LIMIT = 5
const POST_WINDOW_MS = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const tab = request.nextUrl.searchParams.get("tab") ?? undefined
    const gallery = resolveGallery(tab, user.typeCode)

    if (!canAccessGallery(gallery, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리는 볼 수 없어요", 400)
    }

    const posts = await listGalleryPosts(gallery)
    return ok({ gallery, posts })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}

// 친밀도를 지급하는 라우트라 getCurrentUserWithSkin()을 쓴다(calculateReward에 activePetSkin이 필요).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserWithSkin()

    const rateKey = `post:${user.id}`
    const wait = retryAfter(rateKey, POST_LIMIT)
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60)
      return fail("TOO_MANY_ATTEMPTS", `글을 너무 빠르게 올리고 있어요. ${minutes}분 후에 다시 시도해 주세요`, 400)
    }

    const payload = await request.json().catch(() => null)
    const title = typeof payload?.title === "string" ? payload.title.trim() : ""
    const body = typeof payload?.body === "string" ? payload.body.trim() : ""
    const requested = typeof payload?.galleryType === "string" ? payload.galleryType : GalleryType.ALL

    if (!title || !body) return fail("INVALID_BODY", "제목과 본문을 입력해주세요", 400)

    // 화면의 maxLength는 UX다. 신뢰 경계는 여기다 — 상한이 없으면 본문 한 건이
    // 목록 응답(글 20개) 전체를 무겁게 만든다
    if (title.length > TITLE_MAX) {
      return fail("TITLE_TOO_LONG", `제목은 ${TITLE_MAX}자까지 쓸 수 있어요`, 400)
    }
    if (body.length > BODY_MAX) {
      return fail("BODY_TOO_LONG", `본문은 ${BODY_MAX}자까지 쓸 수 있어요`, 400)
    }

    /*
     * 첨부 사진(Post.imageKey). 선택이라 없으면 null 그대로 둔다.
     *
     * **키가 본인 것인지 반드시 확인한다.** presign이 발급한 값이라고 가정하지 않는다 —
     * 이 값은 요청 본문에서 오고, 저장되면 목록·상세가 그대로 cdnUrl()에 넣어 그린다.
     * 검사를 빼면 본문에 `missions/<남의 userId>/….jpg`를 직접 넣는 것만으로 남의 미션
     * 사진이 자기 글 이미지로 커뮤니티에 걸린다. 판정 근거는 _lib/imageKey.ts 주석에 있다.
     */
    const rawImageKey = payload?.imageKey
    let imageKey: string | null = null
    if (rawImageKey !== undefined && rawImageKey !== null) {
      if (typeof rawImageKey !== "string" || rawImageKey.length > IMAGE_KEY_MAX) {
        return fail("INVALID_BODY", "사진 정보를 다시 확인해주세요", 400)
      }
      // 빈 문자열은 "첨부 안 함"과 같게 본다. 화면이 제거 버튼으로 비운 경우다.
      const trimmed = rawImageKey.trim()
      if (trimmed && !isAttachableImageKey(trimmed, user.id)) {
        return fail("INVALID_IMAGE", "잘못된 이미지예요", 400)
      }
      imageKey = trimmed || null
    }

    // 스키마의 GalleryType enum에 있는 값만 받는다(ALL 포함).
    const galleryType = (Object.values(GalleryType) as string[]).includes(requested)
      ? (requested as GalleryType)
      : null
    if (!galleryType) return fail("INVALID_BODY", "갤러리를 찾을 수 없어요", 400)

    // ALL은 누구나, 종족 갤러리는 본인 종족만 쓸 수 있다.
    if (!canAccessGallery(galleryType, user.typeCode)) {
      return fail("FORBIDDEN", "다른 종족의 갤러리에는 글을 쓸 수 없어요", 400)
    }

    // 검증을 통과한 요청만 센다. 빈 제목으로 다섯 번 막히면 정상 사용자가 10분 잠긴다
    recordAttempt(rateKey, POST_WINDOW_MS)

    // 안전 검사(lib/safety.ts). 레이트 리밋을 센 **뒤에** 둔다 — 위 검증 실수와 달리
    // 남을 공격하는 글은 반복 시도 자체를 늦추는 것이 맞다.
    //
    // 낙인 단어(BANNED)는 여기서 검사하지 않는다. 그 목록은 서비스가 사용자를 규정하는
    // 것을 막는 장치이고, 사용자가 자기 상태를 스스로 말하는 것은 막을 이유가 없다.
    // ── 위기 신호를 **모든 차단보다 먼저** 본다 (2026-08-26, 차단 31번 해소) ──
    //
    // 전에는 containsAbuse() 뒤에 있었다. 그래서 위기 신호와 타인 공격이 함께 있는 글이
    // 도움 안내 없이 400을 받았다 — 실측:
    //   "너 병신이냐 나는 죽고 싶다"          abuse=T crisis=T blocks=T → 400 ABUSIVE_CONTENT
    //   "너 같은 새끼 때문에 죽고 싶다"        abuse=T crisis=T blocks=T → 400
    // 차단 30번(moderate 앞으로 옮긴 것)과 **같은 모양의 역전이 이 관문에 남아 있었다.**
    //
    // **우회가 열리지 않는다.** blocksPosting()은 글을 저장하지 않는다 — 공격 글에
    // "죽고 싶다"를 덧붙여도 게시되지 않고, 달라지는 것은 응답뿐이다(400 + "표현을 고쳐주세요"
    // → 200 + 도움 안내). 공격을 통과시키는 분기가 아니므로 D가 우려한 우회와 무관하다.
    if (blocksPosting(`${title} ${body}`)) {
      return ok(crisisBlockedPayload())
    }

    if (containsAbuse(`${title} ${body}`)) {
      return fail("ABUSIVE_CONTENT", "다른 사람을 향한 말이 담겨 있어요. 표현을 고쳐서 다시 올려주세요", 400)
    }

    // 2단 검열(_lib/moderation.ts). 1단계는 사전 정규식(동기), 2단계는 Bedrock 문맥 판정이다.
    // 위 containsAbuse()가 2인칭 지시가 붙은 말만 잡는 데 비해, 이쪽은 우회 표기(ㅄ·시1발)와
    // 욕설이 하나도 없는 모욕("너 임마 청년임?")까지 본다. 둘은 겹치지 않으므로 함께 둔다.
    //
    // 제목과 본문을 합쳐 **한 번만** 부른다. 따로 부르면 Bedrock 왕복이 2회가 되고,
    // 제목에서 시작해 본문으로 이어지는 문장을 반쪽씩만 보게 된다.
    //
    // moderate()는 던지지 않는다 — Bedrock 실패·타임아웃(3초)·모델 ID 미설정을 전부 내부에서
    // 삼키고 1단계 결과를 돌려준다(fail-open). 모델 장애로 글쓰기가 멈추지 않는다.
    //
    // BLOCK만 막는다. WARN은 통과, **SELF는 반드시 통과시킨다** — "나 진짜 병신 같아"는
    // 남을 향한 말이 아니라 이 서비스가 받아내야 할 말이다(moderation.ts JUDGE_SYSTEM 주석).
    //
    // **위기 신호를 검열보다 먼저 본다.** 순서가 뒤집히면 위기 신호 글에 욕설이 섞인 순간
    // 상담 안내 대신 400이 나간다 — POLICY가 BLANKET이라 대상 없는 욕설까지 막는데,
    // 절박한 글에는 자기를 향한 욕이 섞이기 쉽다. 그러면 도움 안내가 가장 필요한 사람에게만
    // 닿지 않는다.
    //
    // **저장하지 않는다(2026-08-25 팀 결정 변경).** 그전에는 글을 그대로 올리고 작성자에게만
    // 안내를 돌려줬다 — "막으면 도움이 가장 필요한 사람의 입을 막는 것이 된다"가 근거였다.
    // 이제는 커뮤니티에 남기는 대신 도움으로 연결한다. 두 결정의 관계와 조건은
    // app/community/_lib/crisis.ts 주석에 있다.
    //
    // **400을 쓰지 않는다.** 사용자가 받는 것은 실패가 아니라 안내여야 한다. 화면(WriteModal)은
    // 이 응답을 받으면 창을 닫지 않고 입력도 지우지 않는다.
    // 판정은 isCrisis()가 아니라 blocksPosting()이다. isCrisis()는 오탐을 허용하도록
    // 설계돼 있어(주석 명시) 사별·보도·비유까지 잡는다 — 안내를 띄우는 데는 맞지만
    // 저장을 막는 기준으로 쓰면 "친구가 자살했다는 소식을 들었다"가 안 올라간다.
    // blocksPosting()은 그중 1인칭 현재의 의도만 남긴다(_lib/crisis.ts).

    /*
     * 텍스트 검열과 사진 판정을 **동시에 시작한다.** 순차로 두면 사진 붙은 글이 5~6초다(실측).
     * 둘 다 네트워크 왕복이고 서로의 결과를 쓰지 않는다.
     *
     * 두 검사 모두 위기 판정(blocksPosting)보다 뒤다 — 위기 신호가 있는 글은 109 안내를
     * 받아야 하는데 그 사람에게 검열·사진 오류를 대신 띄우면 안 된다. 8/25에 moderate()와
     * isCrisis() 사이에서, 8/26에 사진 쪽에서 같은 종류의 순서 버그를 고쳤다(차단 31번).
     * 위쪽 blocksPosting()·containsAbuse()는 동기 함수라 여기 합칠 것이 없다.
     *
     * **Promise.all이 아니라 allSettled다.** all은 먼저 실패한 쪽에서 끊는다. 그러면
     * 텍스트가 먼저 막혔을 때 사진 판정이 끝나지 않아 **유해한 사진이 S3에 남는다** —
     * moderateImage()는 차단으로 판정한 객체를 지우므로 끝까지 가야 한다
     * (_lib/imageModeration.ts). 버킷이 CloudFront로 공개라 글에 안 걸려도 URL이면 열린다.
     *
     * imageKey가 없으면 사진 쪽은 **시작조차 하지 않는다.**
     */
    const [textResult, imageResult] = await Promise.allSettled([
      moderate(`${title}\n\n${body}`, invokeBedrock),
      imageKey ? moderateImage(imageKey) : Promise.resolve(),
    ])

    /*
     * **판정 순서는 텍스트 → 이미지 그대로다.** 둘 다 걸렸을 때 사용자가 보는 문구가
     * 순차였던 오늘과 달라지면 안 된다. 동시에 "시작"만 할 뿐 우선순위는 그대로다.
     */

    // moderate()는 던지지 않는 계약이다(fail-open). 그래도 감추지 않는다 —
    // 순차였을 때도 바깥 catch로 나가 500이 됐고, 계약이 깨진 것을 조용히 통과시키면 안 된다.
    if (textResult.status === "rejected") throw textResult.reason
    if (textResult.value.verdict === "BLOCK") {
      return fail(BLOCK_CODE, textResult.value.message, 400)
    }

    /*
     * 사진 판정(Bedrock Guardrails). **실패하면 막는다(fail-closed).** 이미지에는 정규식
     * 백스톱이 없어서 판정 실패가 곧 노출이다. 근거는 _lib/imageModeration.ts 머리 주석에 있다.
     *
     * 차단 사유(어느 필터인지)는 로그에만 남긴다. 알려주면 우회 실험을 돕는다.
     */
    if (imageResult.status === "rejected") {
      const error = imageResult.reason
      if (error instanceof ImageModerationError) {
        console.error("[imageModeration]", error.kind, imageKey, error.detail)
        return error.kind === "BLOCKED"
          ? fail("BLOCKED_IMAGE", "올릴 수 없는 사진이에요", 400)
          : fail("IMAGE_CHECK_FAILED", "사진을 확인하지 못했어요. 잠시 후 다시 시도해 주세요", 400)
      }
      throw error
    }

    const post = await prisma.post.create({
      data: { userId: user.id, galleryType, title, body, imageKey },
      include: { user: { select: { nickname: true, typeCode: true } } },
    })

    const granted = await grantAffinity(user, POST_AFFINITY)

    // 미션 완료는 본 동작이 끝난 뒤에 별도 try/catch로 부른다.
    // 트랜잭션에 넣지 않는다 — 미션 실패가 글 작성을 롤백시키면 안 된다.
    // 중복 완료는 completeMission 내부에서 P2002를 잡아 newlyCompleted:false로 돌려준다.
    //
    // 주의: completeMission은 하루 상한을 넘겨받은 actor.affinityToday(메모리 값)로 계산하는데
    // 바로 위 grantAffinity는 DB만 갱신하고 user 객체는 그대로 둔다. 두 미션의 rewardAffinity가
    // 0이라(prisma/seed/missions.ts, 2026-08-20 결정) 지금은 무해하지만, 0보다 큰 값을 넣으면
    // 이 호출이 낡은 affinityToday를 보고 하루 상한 100을 넘길 수 있다.
    try {
      await completeMissionByCode({ actor: user, code: "DAILY_COMMUNITY_POST" })
    } catch (error) {
      console.error("[DAILY_COMMUNITY_POST] 미션 완료 처리 실패", error)
    }

    // 저장은 됐지만 걱정되는 신호는 있는 글 — blocksPosting()은 false인데 isCrisis()는
    // true인 경우다(사별·보도·비유·회복 서사). 막지는 않되 안내는 보여준다.
    // 여기 오는 글은 실제로 올라갔으므로 CRISIS_POST_NOTICE("올라갔어요…")가 사실과 맞는다.
    const crisisNotice = isCrisis(`${title} ${body}`) ? CRISIS_POST_NOTICE : null

    return ok({ post, granted, crisisNotice })
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401)
    throw error
  }
}
