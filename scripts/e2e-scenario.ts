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

    const ghost = await call("GET", "/api/community/posts/does-not-exist")
    record("없는 글은 404", ghost.status === 404, ghost.status)
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
