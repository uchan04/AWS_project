// npx tsx scripts/e2e-scenario.ts [http://localhost:3000]
//
// 실제 사용자 한 명이 처음 들어와서 끝까지 가는 경로를 HTTP로 그대로 따라간다.
// 가입 → 진단 → 미션 → 펫 → 커뮤니티 → 챗봇 저장 → 계정 설정 → 탈퇴.
//
// 왜 필요한가: 단위 체크(check:diagnosis 등)는 순수 함수만 본다. 실제로 깨지는 곳은
// 라우트 사이 연결이다 — 인증이 안 붙어 401, 재화가 안 붙어 400, 초기화 순서가 어긋나 500.
// 화면을 손으로 눌러 보는 것으로는 매번 같은 경로를 확인할 수 없다.
//
// ★ 로컬 서버에만 쓴다. 배포 URL로 돌리면 실 DB에 계정을 만들고 지운다.
//   기본 인자가 localhost인 것도 그래서다.
//
// 계정을 두 개 만든다. 두 번째("관찰자")가 첫 번째의 글에 댓글·좋아요를 남긴다 —
// 탈퇴 트랜잭션의 FK 삭제 순서(app/api/auth/withdraw/route.ts)는 그 상황에서만 검증된다.
// 끝나면 둘 다 탈퇴로 지운다. 중간에 실패해 남으면 이메일이 `e2e-`로 시작하는
// 행이 남으므로 다음 실행에 영향은 없다.

// 상한 값을 여기 복사하지 않는다. 라우트가 읽는 그 파일을 읽어야 값이 바뀔 때 같이 따라온다.
// limits.ts는 lib/missions/bands.ts처럼 import가 없어서 스크립트에서도 그냥 불러올 수 있다.
import { TITLE_MAX, BODY_MAX, COMMENT_MAX } from "../app/community/_lib/limits"

const BASE = process.argv[2] ?? "http://localhost:3000"
const EMAIL = `e2e-${Date.now()}@welli.local`
const OTHER_EMAIL = `e2e-other-${Date.now()}@welli.local`
const PASSWORD = "e2e-password-1"

// 레이트 리밋(lib/ratelimit.ts)에 걸리지 않게 실행마다 다른 IP로 위장한다.
// 같은 IP로 두 번 연달아 돌리면 가입이 막히고, 그건 이 스크립트의 실패가 아니라 정상 동작이다.
// 한 번 돌 때 형식이 맞는 가입 요청을 4건 보낸다(SIGNUP_LIMIT은 5) — 가입 검증을
// 더 넣으려면 이 스크립트를 두 IP로 쪼개야 한다.
const FAKE_IP = `198.18.${Math.floor(Date.now() / 1000) % 254}.${(Date.now() % 253) + 1}`

/** 쿠키 저장소. fetch에는 없어서 직접 만든다. 두 계정을 동시에 쓰려면 두 개가 필요하다 */
type Session = { cookie: string }
const me: Session = { cookie: "" }
/** 관찰자 계정. 탈퇴가 "남이 보기에도" 지웠는지 확인하고, 남의 글에 댓글·좋아요를 남긴다 */
const other: Session = { cookie: "" }

let passed = 0
const failures: string[] = []

function record(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1
    console.log(`  ok   ${label}`)
    return
  }
  const line = `${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`
  failures.push(line)
  console.log(`  FAIL ${line}`)
}

type Res = { status: number; body: { data?: unknown; error?: { code: string; message: string } } }

async function call(
  method: string,
  path: string,
  body?: unknown,
  session: Session = me
): Promise<Res> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": FAKE_IP,
      ...(session.cookie ? { cookie: session.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  })

  // Set-Cookie를 직접 모은다. fetch는 쿠키 저장소가 없다
  const setCookie = response.headers.getSetCookie?.() ?? []
  for (const raw of setCookie) {
    const pair = raw.split(";")[0]!
    const name = pair.split("=")[0]!
    const value = pair.slice(name.length + 1)
    const others = session.cookie
      .split("; ")
      .filter((c) => c && !c.startsWith(`${name}=`))
      .join("; ")
    // 값이 빈 Set-Cookie는 삭제 신호다(로그아웃·탈퇴)
    session.cookie = value ? [others, pair].filter(Boolean).join("; ") : others
  }

  const text = await response.text()
  let parsed: Res["body"] = {}
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { error: { code: "NOT_JSON", message: text.slice(0, 120) } }
  }
  return { status: response.status, body: parsed }
}

/** 지표를 하나도 켜지 않는 답 12개 + 형용사. scripts/check-diagnosis.ts의 NO_SIGNAL과 같은 값 */
const ANSWERS = [
  ["Q1", "Q1_ALONE"],
  ["Q2", "Q2_SAFE"],
  ["Q3", "Q3_SAME"],
  ["Q4", "Q4_OK"],
  ["Q5", "Q5_FULL"],
  ["Q6", "Q6_NONE"],
  ["Q7", "Q7_NONE"],
  ["Q8", "Q8_ROOM"],
  ["Q9", "Q9_NONE"],
  ["Q10", "Q10_FIXED"],
  ["Q11", "Q11_STAY"],
  ["Q12", "Q12_NONE"],
  ["Q13", "Q13_ON_PLAN"],
].map(([questionCode, choiceCode]) => ({ questionCode, choiceCode }))

async function main() {
  console.log(`E2E 시나리오 — ${BASE}`)
  console.log(`계정 ${EMAIL} / 위장 IP ${FAKE_IP}\n`)

  // --- 1. 미인증 상태 ---
  console.log("1. 미인증")
  {
    const mine = await call("GET", "/api/diagnosis/me")
    record("보호 API는 401을 준다", mine.status === 401, mine.body)
    const missions = await call("GET", "/api/missions")
    record("미션 조회도 401", missions.status === 401, missions.body)
    const home = await fetch(`${BASE}/`, { redirect: "manual" })
    record("홈은 공개다(200)", home.status === 200, home.status)
    const pet = await fetch(`${BASE}/pet`, { redirect: "manual" })
    record(
      "/pet은 /login으로 보낸다",
      pet.status === 307 && (pet.headers.get("location") ?? "").includes("/login?next=%2Fpet"),
      { status: pet.status, location: pet.headers.get("location") }
    )
  }

  // --- 2. 가입 ---
  console.log("\n2. 가입")
  {
    const bad = await call("POST", "/api/auth/signup", { email: "not-an-email", password: PASSWORD })
    record("이메일 형식 거부", bad.body.error?.code === "INVALID_EMAIL", bad.body)
    const short = await call("POST", "/api/auth/signup", { email: EMAIL, password: "short7" })
    record("8자 미만 거부", short.body.error?.code === "INVALID_PASSWORD", short.body)

    const created = await call("POST", "/api/auth/signup", { email: EMAIL, password: PASSWORD })
    record("가입 성공", created.status === 200, created.body)
    record("세션 쿠키가 붙었다", me.cookie.includes("session="), me.cookie)

    const dup = await call("POST", "/api/auth/signup", { email: EMAIL, password: PASSWORD })
    record("같은 이메일 재가입 거부", dup.body.error?.code === "EMAIL_TAKEN", dup.body)

    // 관찰자 계정. 남의 글에 댓글·좋아요를 남겨 두면 탈퇴 시 FK 순서가 실제로 검증된다
    const observer = await call(
      "POST",
      "/api/auth/signup",
      { email: OTHER_EMAIL, password: PASSWORD },
      other
    )
    record("관찰자 계정 가입", observer.status === 200, observer.body)
    record("두 세션이 서로 다르다", me.cookie !== other.cookie && other.cookie.includes("session="))
  }

  // --- 3. 진단 ---
  console.log("\n3. 진단")
  {
    const before = await call("GET", "/api/diagnosis/me")
    record("진단 전 typeCode는 없다", (before.body.data as { typeCode?: unknown })?.typeCode == null, before.body)

    const forged = await call("POST", "/api/diagnosis/complete", {
      answers: [{ questionCode: "Q1", choiceCode: "NOT_A_CHOICE" }],
    })
    record("없는 선택지 거부", forged.body.error?.code === "INVALID_ANSWER", forged.body)

    const done = await call("POST", "/api/diagnosis/complete", { answers: ANSWERS })
    const result = done.body.data as { typeCode?: string; adjective?: string; nickname?: string } | undefined
    record("진단 완료", done.status === 200, done.body)
    record("유형이 정해졌다", Boolean(result?.typeCode), result)
    record("닉네임이 자동으로 붙었다", Boolean(result?.nickname), result)
    record(
      "내부 세부유형이 응답에 없다",
      !JSON.stringify(done.body).includes("subTypeCode"),
      Object.keys((done.body.data ?? {}) as object)
    )

    const again = await call("POST", "/api/diagnosis/complete", { answers: ANSWERS })
    record("재진단은 막혀 있다", again.body.error?.code === "ALREADY_DIAGNOSED", again.body)

    const renamed = await call("PATCH", "/api/diagnosis/nickname", { nickname: "이엔이" })
    record("닉네임 변경", renamed.status === 200, renamed.body)
    const tooLong = await call("PATCH", "/api/diagnosis/nickname", { nickname: "가".repeat(13) })
    record("13자 닉네임 거부", tooLong.body.error?.code === "INVALID_NICKNAME", tooLong.body)
  }

  // --- 4. 미션 ---
  console.log("\n4. 미션")
  let firstMissionId = ""
  {
    const dash = await call("GET", "/api/missions")
    // 필드 이름은 lib/missions/dashboard.ts의 DTO와 같아야 한다 — dailyMissions·stageMissions다
    const data = dash.body.data as
      | {
          dailyMissions?: { id: string; completed: boolean }[]
          stageMissions?: { stage: number; missions: { id: string }[]; unlocked?: boolean }[]
          attendance?: unknown
          stages?: { current?: number; total?: number; graduated?: boolean }
        }
      | undefined
    record("대시보드 조회", dash.status === 200, dash.body.error)
    record("일일 미션 5개", data?.dailyMissions?.length === 5, data?.dailyMissions?.length)
    record("단계 미션이 있다", (data?.stageMissions?.length ?? 0) > 0, data?.stageMissions?.length)
    record("출석 정보가 있다", data?.attendance != null)
    record("단계 총계가 100이다", data?.stages?.total === 100, data?.stages)
    record("가입 직후는 1단계다", data?.stages?.current === 1, data?.stages?.current)
    record(
      "1단계는 열려 있다",
      data?.stageMissions?.find((s) => s.stage === 1)?.unlocked === true,
      data?.stageMissions?.slice(0, 2)
    )

    firstMissionId = data?.dailyMissions?.find((m) => !m.completed)?.id ?? ""
    record("완료할 일일 미션이 있다", Boolean(firstMissionId))

    if (firstMissionId) {
      const first = await call("POST", `/api/missions/${firstMissionId}/complete`)
      record("미션 완료", first.status === 200, first.body.error)
      const dup = await call("POST", `/api/missions/${firstMissionId}/complete`)
      record(
        "중복 완료는 500이 아니다",
        dup.status === 200 || dup.status === 400,
        { status: dup.status, body: dup.body }
      )
    }

    const ghost = await call("POST", "/api/missions/does-not-exist/complete")
    record("없는 미션은 404나 400", ghost.status === 404 || ghost.status === 400, ghost.status)

    // 대시보드는 잠긴 단계의 미션 id도 내려준다. 그 id로 바로 POST하면 100단계를 순서 없이
    // 긁을 수 있어야 안 된다 — 막는 곳은 lib/missions/completion.ts loadCompletableMission다
    const lockedStage = data?.stageMissions?.find((s) => s.unlocked === false)
    const lockedId = lockedStage?.missions?.[0]?.id
    record("잠긴 단계가 응답에 있다", Boolean(lockedId), lockedStage?.stage)
    if (lockedId) {
      const skip = await call("POST", `/api/missions/${lockedId}/complete`)
      record(
        "잠긴 단계 미션은 완료되지 않는다",
        skip.body.error?.code === "STAGE_LOCKED",
        { stage: lockedStage?.stage, status: skip.status, body: skip.body }
      )
    }

    const claim = await call("POST", "/api/missions/attendance/claim")
    record("출석 수령", claim.status === 200, claim.body.error)
    const claimAgain = await call("POST", "/api/missions/attendance/claim")
    record("같은 날 재수령이 500이 아니다", claimAgain.status !== 500, claimAgain.status)
  }

  // --- 5. 펫 ---
  console.log("\n5. 펫")
  {
    const pet = await call("GET", "/api/pet")
    const data = pet.body.data as { level?: number; seeds?: number } | undefined
    record("펫 조회", pet.status === 200, pet.body.error)
    record("레벨이 있다", typeof data?.level === "number", data)

    const idle = await call("POST", "/api/pet/idle")
    record("방치형 수령이 500이 아니다", idle.status !== 500, { status: idle.status, body: idle.body })

    // 씨앗이 부족한 계정으로 먹이면 400이어야 한다. 500이면 잔액 검사가 없는 것이다
    const feed = await call("POST", "/api/pet/feed", { seeds: 999_999 })
    record("씨앗 초과 먹이기는 400", feed.status === 400, { status: feed.status, body: feed.body })

    const buy = await call("POST", "/api/pet/skins/buy", { skinId: "not-a-skin" })
    record("없는 스킨 구매는 500이 아니다", buy.status !== 500, { status: buy.status, body: buy.body })
  }

  // --- 6. 커뮤니티 ---
  console.log("\n6. 커뮤니티")
  let postId = ""
  {
    const empty = await call("POST", "/api/community/posts", { title: "", body: "" })
    record("빈 글 거부", empty.body.error?.code === "INVALID_BODY", empty.body)

    const created = await call("POST", "/api/community/posts", {
      title: "E2E 시나리오 글",
      body: "이 글은 스크립트가 만들고 마지막에 탈퇴와 함께 지운다.",
      galleryType: "ALL",
    })
    postId = ((created.body.data as { post?: { id: string } })?.post?.id) ?? ""
    record("글 작성", created.status === 200 && Boolean(postId), created.body.error)

    const topics = await call("GET", "/api/community/topics")
    const list = (topics.body.data as { topics?: unknown[] })?.topics
    // 배열이면 통과다. 로컬에 AWS 자격증명이 없으면 Bedrock 호출이 실패하고 라우트가
    // 설계대로 빈 배열을 준다(화면은 정적 주제로 넘어간다) — 그건 버그가 아니다
    record("주제 추천이 배열이다", Array.isArray(list), topics.body)

    if (postId) {
      const comment = await call("POST", `/api/community/posts/${postId}/comments`, {
        body: "내 글에 내가 남기는 댓글",
      })
      record("댓글 작성", comment.status === 200, comment.body.error)

      const like = await call("POST", `/api/community/posts/${postId}/like`)
      record("좋아요", like.status === 200, like.body.error)
      const unlike = await call("POST", `/api/community/posts/${postId}/like`)
      record("좋아요 취소가 500이 아니다", unlike.status !== 500, unlike.status)

      const detail = await call("GET", `/api/community/posts/${postId}`)
      record("상세 조회", detail.status === 200, detail.body.error)

      // 남이 남긴 댓글·좋아요. 탈퇴 트랜잭션이 이것부터 지우지 않으면 Post 삭제가 FK로 막혀 500이 난다
      const otherComment = await call(
        "POST",
        `/api/community/posts/${postId}/comments`,
        { body: "남이 남기는 댓글" },
        other
      )
      record("남의 댓글 작성", otherComment.status === 200, otherComment.body.error)
      const otherLike = await call("POST", `/api/community/posts/${postId}/like`, undefined, other)
      record("남의 좋아요", otherLike.status === 200, otherLike.body.error)
      const otherView = await call("GET", `/api/community/posts/${postId}`, undefined, other)
      record("남도 이 글을 볼 수 있다", otherView.status === 200, otherView.body.error)
    }

    // 길이 상한(app/community/_lib/limits.ts). 화면 maxLength는 우회되므로 서버가 막아야 한다.
    // 상한 초과는 레이트 리밋 카운트에 들어가지 않는다(recordAttempt는 검증 통과 후에 부른다)
    const longTitle = await call("POST", "/api/community/posts", {
      title: "가".repeat(TITLE_MAX + 1),
      body: "본문",
      galleryType: "ALL",
    })
    record("제목 상한 초과 거부", longTitle.body.error?.code === "TITLE_TOO_LONG", longTitle.body)

    const longBody = await call("POST", "/api/community/posts", {
      title: "제목",
      body: "가".repeat(BODY_MAX + 1),
      galleryType: "ALL",
    })
    record("본문 상한 초과 거부", longBody.body.error?.code === "BODY_TOO_LONG", longBody.body)

    if (postId) {
      const longComment = await call("POST", `/api/community/posts/${postId}/comments`, {
        body: "가".repeat(COMMENT_MAX + 1),
      })
      record("댓글 상한 초과 거부", longComment.body.error?.code === "COMMENT_TOO_LONG", longComment.body)
    }

    // 안전 판정. 오탐 쪽을 먼저 확인한다 — 아래 도배 검사가 한도를 다 쓰기 전에
    // "통과해야 하는 글"을 써야 한다.
    //
    // 2026-08-24 정책 변경: D가 `app/community/_lib/moderation.ts`에 `POLICY = "BLANKET"`을
    // 넣어 **대상이 없어도 사전에 걸리면 막는다**. 그 전까지 이 자리는 "대상 없는 욕설은
    // 막지 않는다"(`lib/safety.ts` containsAbuse의 기록된 결정)를 단정했다. 사용자 결정으로
    // D의 변경을 따르기로 해서 단정을 뒤집는다 — 정규화(`씨 발`·`시1발`·`병@신`·`ㅂㅕㅇㅅㅣㄴ`)까지
    // 함께 들어왔고 그쪽은 이전에 뚫려 있던 우회를 막는다.
    // 차단 케이스에 **우회 표기**를 쓴다. 글 하나로 두 가지를 함께 확인한다 —
    // 차단된 요청도 레이트 리밋 한도를 쓰므로(아래 도배 검사가 그 한도를 센다)
    // 검사마다 글을 하나씩 늘리면 도배 검사가 먼저 걸려 무관한 실패가 난다
    const venting = await call("POST", "/api/community/posts", {
      title: "시1발 오늘 진짜 힘들었다",
      body: "누구한테 하는 말도 아니고 그냥 혼자 하는 말이다. 숫자를 끼운 우회 표기다.",
      galleryType: "ALL",
    })
    record(
      "BLANKET 정책: 대상 없는 욕설도, 우회 표기(시1발)도 막는다",
      venting.body.error?.code === "BLOCKED_EXPRESSION",
      venting.body,
    )

    // 통과해야 하는 글. 욕설이 없으면 막히지 않는다 — 아래 도배 검사가 한도를 쓰기 전에 필요하다
    const plain = await call("POST", "/api/community/posts", {
      title: "오늘 진짜 힘들었다",
      body: "누구한테 하는 말도 아니고 그냥 혼자 하는 말이다. 이건 막히면 안 된다.",
      galleryType: "ALL",
    })
    record("욕설 없는 혼잣말은 통과한다", plain.status === 200, plain.body.error)

    // 2026-08-25 정책 변경(D): 위기 신호 글은 **저장하지 않고** 도움 경로를 안내한다.
    // 400이 아니라 200 + { crisisBlocked, notice }다 — 400은 화면에서 빨간 오류로 읽히고
    // 지금 이 사람에게 필요한 것은 거절 통보가 아니다. 그래서 status는 200을 단정한다.
    const crisisPost = await call("POST", "/api/community/posts", {
      title: "요즘 생각",
      body: "그냥 사라지고 싶다는 생각이 자주 든다.",
      galleryType: "ALL",
    })
    const crisisData = crisisPost.body.data as
      | { crisisBlocked?: boolean; notice?: string; post?: unknown }
      | undefined
    record(
      "위기 신호 글은 저장하지 않고 도움 안내를 준다 (200, 거절이 아니다)",
      crisisPost.status === 200 && crisisData?.crisisBlocked === true && Boolean(crisisData?.notice),
      crisisPost.body,
    )
    // 저장되지 않았다는 사실이 응답 모양으로 드러나야 화면이 목록에 밀어 넣지 않는다
    record("위기 신호 글 응답에 post가 없다", crisisData?.post === undefined, crisisPost.body)
    // 안내 문구가 거절로 읽히면 안 된다. app/community/_lib/crisis.ts의 BLAMING_WORDS와 같은 목록
    record(
      "위기 안내 문구에 비난하는 말이 없다",
      !["차단", "부적절", "규정", "위반", "금지", "삭제되었"].some((w) =>
        (crisisData?.notice ?? "").includes(w),
      ),
      crisisData?.notice,
    )
    // 오탐이 곧 "글이 사라지는 것"이 된 뒤로 가장 위험한 경로다 — 사별 글은 올라가야 한다
    const bereaved = await call("POST", "/api/community/posts", {
      title: "친구 소식",
      body: "친구가 자살했다는 소식을 들었다. 아직 실감이 안 난다.",
      galleryType: "ALL",
    })
    const bereavedData = bereaved.body.data as
      | { crisisBlocked?: boolean; post?: unknown }
      | undefined
    record(
      "사별 글은 막지 않는다 (blocksPosting이 isCrisis보다 좁다)",
      bereaved.status === 200 && !bereavedData?.crisisBlocked && Boolean(bereavedData?.post),
      bereaved.body,
    )

    const abusive = await call("POST", "/api/community/posts", {
      title: "화가 난다",
      body: "너 진짜 병신이네",
      galleryType: "ALL",
    })
    record("타인 공격 글은 거부", abusive.body.error?.code === "ABUSIVE_CONTENT", abusive.body)

    if (postId) {
      const abusiveComment = await call("POST", `/api/community/posts/${postId}/comments`, {
        body: "넌 진짜 한심하다",
      })
      record("타인 공격 댓글은 거부", abusiveComment.body.error?.code === "ABUSIVE_CONTENT", abusiveComment.body)

      // 글과 같은 기준이다(같은 blocksPosting). 두 라우트가 다른 모양을 주면 화면이 각각 처리해야 한다
      const crisisComment = await call("POST", `/api/community/posts/${postId}/comments`, {
        body: "저도 죽고 싶었던 날이 있었어요.",
      })
      const commentData = crisisComment.body.data as
        | { crisisBlocked?: boolean; notice?: string; comment?: unknown }
        | undefined
      record(
        "위기 신호 댓글도 저장하지 않고 도움 안내를 준다",
        crisisComment.status === 200 &&
          commentData?.crisisBlocked === true &&
          Boolean(commentData?.notice),
        crisisComment.body,
      )
      record("위기 신호 댓글 응답에 comment가 없다", commentData?.comment === undefined, crisisComment.body)
    }

    const ghost = await call("GET", "/api/community/posts/does-not-exist")
    record("없는 글은 404", ghost.status === 404, ghost.status)

    // 도배 방어. 위에서 성공한 글이 3건이라 남은 한도는 2건이고 그 다음이 막혀야 한다.
    // (공격 글은 레이트 리밋을 센 뒤에 거부되므로 그것도 한도를 쓴다)
    // 여기서 만든 글은 마지막 탈퇴가 함께 지운다. 이 블록 뒤로는 글을 쓰지 않는다 —
    // 한도를 다 쓴 상태라 뒤에 글 작성을 넣으면 그 검사가 거짓 실패한다
    let blocked = ""
    for (let i = 0; i < 8 && !blocked; i++) {
      const flood = await call("POST", "/api/community/posts", {
        title: `도배 ${i}`,
        body: "레이트 리밋 검증용",
        galleryType: "ALL",
      })
      if (flood.body.error?.code === "TOO_MANY_ATTEMPTS") blocked = `${i + 2}번째에서 막힘`
    }
    record("연속 글 작성은 레이트 리밋에 막힌다", blocked !== "", blocked || "8번 더 써도 안 막혔다")
  }

  // --- 7. 챗봇 저장 ---
  console.log("\n7. 챗봇")
  {
    // 스트리밍(Bedrock 실호출)은 부르지 않는다 — 토큰이 들고 자격증명에 따라 실패한다.
    // 저장 경로만 본다
    const saved = await call("POST", "/api/chat/messages", {
      role: "USER",
      content: "E2E 시나리오가 남기는 메시지",
    })
    record("메시지 저장이 500이 아니다", saved.status !== 500, { status: saved.status, body: saved.body })

    // 라우트는 클라이언트가 보낸 role을 무시하고 항상 USER로 저장한다
    // (app/api/chat/messages/route.ts). 그래야 남이 챗봇 답변을 위조해 넣지 못한다
    const forged = await call("POST", "/api/chat/messages", { role: "ASSISTANT", content: "위조 시도" })
    const stored = (forged.body.data as { message?: { role?: string } })?.message?.role
    record("클라이언트가 보낸 role은 무시되고 USER로 저장된다", stored === "USER", {
      status: forged.status,
      body: forged.body,
    })
  }

  // --- 8. 계정 설정 ---
  console.log("\n8. 계정 설정")
  {
    const page = await fetch(`${BASE}/settings`, {
      headers: { cookie: me.cookie },
      redirect: "manual",
    })
    record("설정 화면이 열린다", page.status === 200, page.status)

    const wrong = await call("POST", "/api/auth/password", {
      currentPassword: "wrong",
      newPassword: "e2e-password-2",
    })
    record("현재 비밀번호 틀리면 401", wrong.status === 401, wrong.body)

    const changed = await call("POST", "/api/auth/password", {
      currentPassword: PASSWORD,
      newPassword: "e2e-password-2",
    })
    record("비밀번호 변경", changed.status === 200, changed.body)

    const old = await call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD })
    record("옛 비밀번호로는 못 들어온다", old.status === 401, old.body)

    const relogin = await call("POST", "/api/auth/login", { email: EMAIL, password: "e2e-password-2" })
    record("새 비밀번호로 로그인", relogin.status === 200, relogin.body)
  }

  // --- 9. 탈퇴 ---
  console.log("\n9. 탈퇴")
  {
    const noPassword = await call("POST", "/api/auth/withdraw", {})
    record("비밀번호 없이는 못 지운다", noPassword.status === 401, noPassword.body)

    const gone = await call("POST", "/api/auth/withdraw", { password: "e2e-password-2" })
    record("탈퇴 성공", gone.status === 200, gone.body)
    record("세션 쿠키가 지워졌다", !me.cookie.includes("session="), me.cookie)

    const after = await call("POST", "/api/auth/login", { email: EMAIL, password: "e2e-password-2" })
    record("지운 계정으로는 로그인 안 된다", after.status === 401, after.body)

    if (postId) {
      // 미인증으로 부르면 401이라 지워졌는지 알 수 없다. 살아 있는 관찰자 계정으로 본다
      const post = await call("GET", `/api/community/posts/${postId}`, undefined, other)
      record("탈퇴한 사람의 글도 남이 보기에 사라졌다", post.status === 404, {
        status: post.status,
        body: post.body,
      })
    }

    // 같은 이메일로 다시 가입할 수 있어야 한다 — 하드 삭제라 이메일 유니크가 풀렸다
    const rejoin = await call("POST", "/api/auth/signup", { email: EMAIL, password: PASSWORD })
    record("같은 이메일로 재가입된다", rejoin.status === 200, rejoin.body)
    const cleanup = await call("POST", "/api/auth/withdraw", { password: PASSWORD })
    record("재가입 계정 정리", cleanup.status === 200, cleanup.body)

    const otherGone = await call("POST", "/api/auth/withdraw", { password: PASSWORD }, other)
    record("관찰자 계정 정리", otherGone.status === 200, otherGone.body)
  }

  console.log(`\n통과 ${passed}건, 실패 ${failures.length}건`)
  if (failures.length) {
    console.log("\n실패 목록:")
    for (const line of failures) console.log(`  - ${line}`)
    process.exit(1)
  }
  console.log("E2E 시나리오 통과")
}

void main()
