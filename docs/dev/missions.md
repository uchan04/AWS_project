# 미션 시스템 개발 문서 (담당 B)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 4절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 미션 조회 API, 일반·이벤트 완료, 출석, S3 업로드, Bedrock 사진 판정, 단계 해금, streak, UI 연결
- 완료: **단계 3개 → 100개 확장 (2026-08-22, A).** 아래 "100단계 커리큘럼" 절. `SPEC.md` 4절도 같이 다시 썼다
- 완료: **"오늘 이거 하나만" 집중 카드 (2026-08-23)** — 아래 절
- 완료: **미션 완료 왕복 8→7회 + 낙관적 갱신. 체감 1.6초 → 6ms (2026-08-23)** — 아래 절
- 완료: **일일 미션 제목 알약 제거 (2026-08-23)** — `일일 미션 [3 / 5]`가 200px 위 `오늘 달성률` ProgressCard와 **같은 문자열**이었고, 집중 카드의 `나머지 N개는 아래에 있어요`까지 합쳐 한 화면에서 같은 사실이 세 번이었다. ProgressCard를 남긴 이유는 그것이 `이번 주`·`연속 달성`과 **3칸 한 세트**라 하나만 빼면 격자가 어긋나기 때문이다. `StepSection`의 `progress` prop 자체는 **단계 섹션이 쓴다** — 그쪽 값(`2 / 3 완료` 또는 잠금 안내)은 화면 어디에도 다시 나오지 않으므로 중복이 아니다. `출석 캘린더`의 `누적 N일`도 `연속 달성 N일`과 다른 값이라 남긴다
- 진행 중: 없음
- 미착수: 일일 전체 완료 별조각 보너스(값은 60으로 확정), 7일 streak 별조각 보너스

## 100단계 커리큘럼 (2026-08-22, A가 추가)

3단계 12개로는 "방에서 나오는 것"까지만 다루고 그 뒤가 없었다. 100단계를 끝내면 정기적으로 나가고 사람과 약속을 잡는 상태가 되도록 다시 짰다.

| 파일 | 역할 |
|---|---|
| `lib/missions/bands.ts` | 상수와 순수 함수만. `TOTAL_STAGES=100`, `MISSIONS_PER_STAGE=3`, `REQUIRED_PER_STAGE=2`, `BAND_LABELS` 10개, `rewardForStage()`. **import를 두지 않는다** — 시드 스크립트와 클라이언트 컴포넌트가 같은 값을 읽어야 한다 |
| `prisma/seed/curriculum.ts` | 유형당 300슬롯. 고유 미션 123개를 평균 2.44회 재등장시킨다(최소 1, 최대 7) — 습관이 되도록 이전 미션을 다시 넣는 것이 설계 의도다 |
| `lib/missions/stages.ts` | 해금 계산. 100단계가 되면서 단계마다 `filter`를 돌던 O(단계×미션)을 한 번의 그룹핑으로 바꿨다(3만 번 비교/요청). `currentStageOf()`·`isGraduated()` 추가 |
| `scripts/check-curriculum.ts` | 슬롯 수·재등장 분포·사진 슬롯을 센다. `npm run check:curriculum` |

- 구간 10개 × 10단계. 이름은 화면에 그대로 뜬다(방 안에서 → 집 안 생활 → 문 앞까지 → 동네 한 바퀴 → 가게와 시설 → 조금 더 멀리 → 한마디 건네기 → 대화와 모임 → 관계 이어가기 → 사회로 한 걸음)
- 보상은 구간에 비례한다. 씨앗 `18 + 구간×4`(22~58), 별조각 `구간-2`(3구간부터, 0~8). **친밀도는 0** — 주면 커뮤니티·채팅 지급과 겹쳐 하루 상한을 미션만으로 채운다
- 사진 미션은 유형당 38~41슬롯, 3구간부터
- 화면은 `currentStageOf()`가 정한 단계를 기본으로 띄운다. 1단계부터 열면 37단계 사용자가 화살표를 36번 눌러야 한다
- **옛 시드가 만든 단계당 4번째 미션 9개가 실 DB에 남아 있다.** 지우지 않고 **코드에서 배제한다**(공유 DB는 손대지 않기로 했다). 조회 3곳(`catalog.ts:71`, `dashboard.ts:108`, `stages.ts:98`)이 `order <= MISSIONS_PER_STAGE`로 거르고, 완료 경로도 2026-08-22에 같은 조건을 갖췄다(아래). `scripts/prune-orphan-stage-missions.ts`는 **조회 전용으로 바꿨다**(2026-08-24) — "실행하지 않는다"는 주석만으로는 `--apply` 한 번이 팀 완료기록을 지울 수 있어서, 삭제 경로 자체를 코드에서 걷어냈다. 남은 것은 몇 행이 남아 있는지 세어 보는 것뿐이다

## 완료 경로 검증 통합 (2026-08-22, A)

완료 라우트 두 곳이 각자 `findUnique(id)` → 404 → 단계 해금 검사를 **복사해** 갖고 있었고, 조회 쪽에는 있던 두 조건이 어느 쪽에도 없었다.

| 뚫려 있던 것 | 어떻게 뚫렸나 |
|---|---|
| 잠긴 단계 건너뛰기 | 대시보드는 잠긴 단계의 미션 id도 `unlocked: false`와 함께 내려준다. 그 id로 바로 POST하면 순서를 무시하고 100단계를 긁을 수 있다 — 라우트의 해금 검사가 이걸 막고 있었지만 두 라우트에 복사돼 있어 한쪽만 고치면 갈라진다 |
| 남의 유형 단계 미션 | `typeCode` 일치 검사가 없었다. 조회로는 안 나오지만 완료는 됐다 |
| 커리큘럼 밖 슬롯 | 위 `order = 4` 9행. 화면에는 안 뜨는데 완료되고 보상까지 나갔다 |

`lib/missions/completion.ts`의 `loadCompletableMission(userId, typeCode, missionId)` 하나로 합쳤다. 존재·유형·슬롯 상한·단계 해금을 순서대로 보고 `{ mission }` 또는 `{ error: Response }`를 준다. 남의 유형과 슬롯 밖은 `STAGE_LOCKED`가 아니라 **404 `MISSION_NOT_FOUND`** — 존재를 알려 줄 이유가 없다.

- `app/api/missions/[missionId]/complete/route.ts` — 검사 3블록을 3줄로 교체
- `app/api/upload/verify/route.ts` — 같음. `requiresPhoto` 검사만 라우트에 남았다(이 라우트만의 조건이다)
- `npm run e2e`에 단정 2건 추가 — 잠긴 단계 id를 응답에서 꺼내 POST하고 `STAGE_LOCKED`를 확인한다. 남의 유형·슬롯 밖은 클라이언트가 id를 알 수 없어 HTTP로 재현할 수 없다(코드 검사로만 방어)

## 구현한 파일

### 도메인 로직
- `lib/missions/reset.ts` — 날짜 helper, 접속 시점 초기화
- `lib/missions/stages.ts` — 단계 해금 계산
- `lib/missions/dashboard.ts` — 전체 DTO 조립
- `lib/missions/completion.ts` — 공통 완료 함수, completeMissionByCode(), `loadCompletableMission()`(완료 전 검증. 위 절 참고)
- `lib/missions/attendance.ts` — 출석 7일 주기, P2002 idempotent
- `lib/missions/upload.ts` — S3 presigned URL, 객체 검증
- `lib/missions/vision.ts` — Bedrock Converse + Nova Tool Use

### API
- `GET /api/missions` — dashboard 조회, 일일 5개 + 단계별 미션 + progress + attendance
- `POST /api/missions/[missionId]/complete` — 일반 미션 완료
- `POST /api/missions/attendance/claim` — 출석 수령
- `POST /api/upload/presign` — S3 업로드 URL 발급
- `POST /api/upload/verify` — 사진 판정 + 통과 시 완료

### 화면
- `app/missions/page.tsx` — **서버에서 대시보드를 조립해 props로 내려보낸다**(2026-08-23). 전에는 `return <MissionDashboard />` 한 줄이었고 데이터는 클라이언트 `fetch("/api/missions")`가 가져왔다 — LCP 4324ms의 원인이었다. 조립 순서는 라우트와 같은 함수를 쓴다(`ensureMissionReset` → `buildDashboard`). 세부는 `docs/dev/perf.md`
- `app/missions/MissionDashboard.tsx` — 기존 Figma JSX 보존, API 연결, ProgressCard, AttendanceCalendar. `initial`/`initialError` prop을 받으면 마운트 fetch를 건너뛴다(prop 생략 시 예전 동작)
- `app/missions/mission-ui.module.css` — 애니메이션 keyframes

## 결정한 것과 이유
- 초기화는 스케줄러 없이 `lastMissionResetAt` 비교, 같은 날 반복 조회 시 초기화 중복 실행 안 함
- 일일 `resetKey = YYYY-MM-DD`, 단계 `resetKey = STAGE`
- 중복 완료는 UserMission/AttendanceClaim `@@unique` 제약 + Prisma `P2002`로만 판정, 애플리케이션 사전 조회 금지
- 완료 기록과 보상은 단일 DB 트랜잭션, P2002는 추가 보상 0인 idempotent 결과로 변환
- 모든 보상은 `getCurrentUserWithSkin()` → `calculateReward()` → `capAffinity()` 순서
- 단계 해제는 이전 단계 **3개 중 2개** 완료 (`REQUIRED_PER_STAGE`). 2026-08-22 이전에는 4개 중 3개였다 — 100단계가 되면서 오늘 못 하는 미션 하나가 전체를 막지 않도록 낮췄다
- 출석 `dayIndex = (attendanceTotal - 1) % 7 + 1`
- DAILY_COMMUNITY_POST, DAILY_CHAT는 `completeMissionByCode()`로만 완료 (D 담당 연결 필요)
- S3 key는 서버가 생성 (`missions/{userId}/{missionId}/{randomId}.{ext}`)
- 사진 판정은 S3 이미지 + `Mission.description` → Bedrock Converse → Nova 멀티모달 → Tool Use `{passed, reason}`
- Tool schema 최상위에는 `type`, `properties`, `required`만 사용 (`additionalProperties` 제외)
- `toolChoice`로 `verify_mission` 강제, `temperature: 0`, `topK: 1`

## 막힌 것
- 실제 S3 환경변수와 Bedrock 권한 미검증 — `.env`의 `S3_BUCKET`, `BEDROCK_VISION_MODEL_ID` 값 필요
- 출석 보상표 임시 값 (팀 합의 필요)
- ~~일일 전체 완료·7일 streak 별조각 보너스 수치 미확정~~ — 일일 전체 완료 = **별조각 60**으로 확정(2026-08-20 팀 결정, `SPEC.md` 5절). `lib/missions/completion.ts`가 `calculateReward()`를 거쳐 지급한다
- ~~D 담당의 `completeMissionByCode()` 연결 대기~~ — 해소(2026-08-21). `DAILY_COMMUNITY_POST`·`DAILY_CHAT` 두 라우트가 실제로 호출한다

## 다음 할 일
- E와 S3·Bedrock 환경 구성 확인
- 실제 RDS·S3·Bedrock 통합 테스트
- A의 이벤트 미션 친밀도 0 반영 확인
- D에게 `completeMissionByCode()` 사용 방법 전달
- 출석·보너스 보상 값 팀 합의 후 반영

## "오늘 이거 하나만" 집중 카드 (2026-08-23)

일일 미션 5개를 격자로 한 번에 보여 주면 고립은둔 상태에서는 목록 자체가 부담이 된다. 안 한 것 중 **첫 하나만** 위에 큰 카드로 올리고, 나머지는 그 아래 격자에 그대로 둔다.

`app/missions/MissionDashboard.tsx`:

```
const undone = dashboard.dailyMissions.filter((m) => !m.completed)
const focus = undone[0]
const rest = focus ? dashboard.dailyMissions.filter((m) => m.id !== focus.id) : dashboard.dailyMissions
```

`develop`도 같은 것을 만들었지만 세 가지가 달랐고 그래서 그 코드를 쓰지 않았다.

| develop | 지금 |
|---|---|
| 집중 카드의 미션이 아래 격자에도 **다시 나왔다** | `rest`에서 `focus.id`를 뺀다 |
| `title.includes("휴식")`으로 이모지를 골랐다 | 이미 있는 `getEmojiForMission()`을 쓴다 |
| `mission.code === "DAILY_REST"`를 하드코딩했다 | 코드를 특별 취급하지 않는다 |

전부 완료면 집중 카드를 감추고 부제를 "오늘 다 했어요. 내일 또 만나요"로 바꾼다.

실측(2026-08-23, 브라우저 1280px): 집중 카드 = `커튼 열고 햇빛 보기`, 안내 = `나머지 2개는 아래에 있어요`(미완 3개 − 1), 아래 격자에 나머지 4개가 뜨고 **중복은 0건**이었다. 진행률 `2 / 5`, 단계 `1 / 100 단계`.

## 사진 업로드 권한 구멍 (2026-08-23, 수정)

`POST /api/upload/presign`이 `findUnique(id)`만 해서 **남의 유형 미션이나 잠긴 단계의 미션 id로도 presigned PUT URL이 나갔다.** 미션은 완료되지 않지만 S3 버킷에는 쓸 수 있었다. 코드에 있던 `// TODO: 단계 해금 확인 추가 가능`이 그 구멍이다.

완료 경로와 **같은** `loadCompletableMission()`을 태우도록 바꿨다. 검증이 한 곳에만 있으므로 완료 조건이 바뀌어도 업로드 쪽이 뒤처지지 않는다.

## /missions 지연 절감 (2026-08-23, A)

`/missions`가 정상 상태에서도 TTFB 743ms였다. RDS가 us-east-1이라 왕복 1회가 177ms이므로 왕복 4회분이다. 측정 없이 손대지 않으려고 계측 스크립트를 먼저 만들었다(`scripts/perf-*.ts`, 전부 읽기 전용).

**후보를 하나씩 각하한 순서**가 이 절의 핵심이다. 같은 증상을 다시 만나면 이 순서로 다시 좁힌다.

| 후보 | 실측 | 판정 |
|---|---|---|
| 링크·네트워크 | `SELECT 1` 40회가 40/40 전부 177±4ms | 각하. 링크는 완벽하다 (`perf-rtt.ts`) |
| 연결 풀 지연 생성 | raw 6개 동시 묶음이 1회차 9.2배, 이후 12회 연속 1.0배 · 연결 수 34 고정 | 1회차만. 정상 상태 원인 아님 (`perf-converge.ts`) |
| N+1 / 관계 필터 펼침 | ORM 쿼리마다 SQL **정확히 1문** | 각하 (`perf-sqlcount.ts`) |
| 페이로드 크기 | STAGE 300행을 `{id, stage}`로 줄여 80.8KB → 16.7KB(79% 감소)했으나 벽시계는 2% **증가** | 각하. 페이로드는 원인이 아니었다 (`perf-dashboard-ab.ts` 초판) |
| `connection_limit` 조정 | 1 → 1086ms(=6×181, 완전 직렬) · 2 → 540ms · 5 → 541ms · 10 → 534ms · **기본 25 → 365ms** | 각하. 낮추면 그만큼 직렬화된다. **E 소유 `DATABASE_URL`은 손댈 이유가 없다** (`perf-limit.ts`) |
| **prepare 왕복 × 연결 수** | 처음 보는 문을 내는 연결은 왕복 2회(362ms), 두 번째부터 180ms 고정 | **← 원인** (`perf-prepare.ts`) |

Postgres 확장 프로토콜에서 처음 보는 문은 prepare에 왕복을 한 번 더 쓴다. 그 캐시는 **연결마다** 따로다. 순차 실행은 같은 연결을 재사용해 2회차부터 적중하지만, `buildDashboard`는 6개를 `Promise.all`로 내 서로 다른 연결에 흩어진다. 풀 상한이 25면 채워야 할 조합이 문 6개 × 연결 25개 = 준비 150회이고, 저트래픽 앱은 그 예열을 끝내지 못한다. 그래서 벽시계가 182~728ms(왕복 1~4회)를 계속 오갔다 — `perf-sqlcount.ts`가 한 묶음 안의 engine duration을 179 / 352 / 353 / 354 / 358 / 717ms로 **혼재**하게 찍은 것이 그 증거다.

레버는 **문의 개수**뿐이었다. 그리고 6개 중 2개는 사용자와 무관했다 — 미션 카탈로그는 시드 스크립트로만 바뀌는 불변 데이터인데 요청마다 다시 읽고 있었다.

| 파일 | 역할 |
|---|---|
| `lib/missions/catalog.ts` | 신규. `getDailyMissionCatalog()`·`getStageMissionCatalog(typeCode)`. TTL 5분, 진행 중 요청 합침(Promise를 캐시), 실패 시 즉시 무효화, `clearMissionCatalog()` |
| `lib/missions/dashboard.ts` | DB 쿼리 6개 → 4개. 카탈로그 80.8KB → 0KB |
| `lib/missions/stages.ts` | `getStageProgress()` DB 쿼리 2개 → 1개 (완료 API 경로) |

- **TTL을 둔 이유** — 시드를 다시 돌렸을 때 서버 재시작 없이 5분 안에 반영된다. 미션 문구가 5분 늦게 뜨는 것은 문제가 아니고, 대신 "재시작 전까지 옛 문구가 박혀 있다"는 함정을 없앤다
- **진행 중 요청을 합친 이유** — 캐시가 비었을 때 동시 요청 N개가 같은 쿼리를 N번 내는 것을 막는다
- 메모리는 유형 8개 × 300행 ≈ 600KB 상한. 프로세스별이므로 Amplify 인스턴스마다 따로 예열된다

**전후** (같은 세션에서 번갈아 12회, `perf-dashboard-ab.ts`)

```
buildDashboard  p50 542ms -> 182ms (66% 감소). 왕복 정확히 1회로 수렴 고정
DTO 동등성      현재 단계·창 안 미션 수·일일 완료 전부 일치
```

**정상 상태 TTFB** (경로당 10표본, `bash scripts/perf-ttfb.sh 3101 10`)

| 경로 | 전 | 후 | |
|---|---|---|---|
| `/missions` | 743ms | **376ms** | 49% 감소. 진동 363~729ms → 374~379ms로 안정 |
| `/api/missions` | 716ms | **367ms** | 49% 감소 |
| `/` | 730ms | **380ms** | 48% 감소 |
| `/pet` `/community` `/settings` `/api/pet` `/api/community/posts` | — | 변화 없음 | 미션 경로를 타지 않는다 |

376ms는 왕복 2회다 — `getCurrentUser()` 1회 + `buildDashboard()` 1회. 이 둘은 순서 의존이라(사용자 행을 읽어야 대시보드를 만든다) 현재 구조의 바닥이다. 더 줄이려면 세션 쿠키에 표시용 필드를 담는 식이 되는데, 재화·streak가 낡은 값으로 뜨는 대가가 178ms보다 크다.

검증: `npm run e2e` 75/75, `check:*` 7종, `tsc --noEmit`, `lint`, `build` 전부 통과.

**남긴 것** — `lib/missions/completion.ts`의 `mission.findUnique` 3곳은 단건 조회라 캐시 인덱스를 만들지 않았다. 사용자 탭 1회당 왕복 1회이고, 유형 8개 전체를 id로 색인하는 복잡도가 그 178ms보다 비싸다.

## 미션 완료가 1.6초 걸리던 것 (2026-08-23, A)

읽기 경로만 고쳐 놓고 쓰기 경로를 재보지 않았다. 재보니 4배 느렸다 — `POST /api/missions/:id/complete`가 1466ms, 왕복 8.1회. `/missions` 읽기가 376ms인데 탭 한 번이 그 4배였다.

`scripts/perf-write-path.ts`로 단계별로 쪼갰다(기준선 175ms). 라우트를 봐서는 어느 단계가 몇 회를 쓰는지 모른다 — **트랜잭션 안의 `await` 하나하나가 각각 왕복 1회**다.

```
getCurrentUserWithSkin                     2.0회
loadCompletableMission 전체                 2.0회  (findUnique 1 + getStageProgress 1)
completeMission                            4.0회  (mission 재조회 1 + BEGIN 1 + create 1 + COMMIT 1)
                                        ────────
                                           8.0회   ← curl 8.1회와 일치
```

이 스크립트는 **이미 완료한 미션만** 쓴다. `userMission.create`가 P2002로 되돌아가므로 공유 개발 DB가 바뀌지 않는다. 완료한 단계 미션이 없으면 실행을 거부한다.

### 1. 중복 조회 제거 (왕복 8 → 7회)

`completeMission()`이 호출부가 방금 읽은 `mission` 행을 다시 읽고 있었다. 호출부 3곳 모두 직전에 같은 행을 읽는다 — `loadCompletableMission()`은 검증하려고, `completeMissionByCode()`는 code로 id를 찾으려고.

optional `mission` 파라미터로 넘겨받되 **`mission.id !== missionId`면 무시하고 다시 읽는다.** 이 검사가 없으면 남의 미션 행이 들어와 엉뚱한 보상이 나간다. 넘기지 않으면 예전대로 동작하므로 기존 호출부는 그대로다.

```
1466ms 왕복 8.1회  ->  p50 1253ms 왕복 7.0회   (-213ms)
진동 1461~1652ms   ->  1247~1257ms
```

### 2. 낙관적 갱신 — 체감 1.6초 → 6ms

남은 왕복은 더 줄일 몫이 거의 없다. **트랜잭션의 BEGIN·COMMIT이 보상 지급의 원자성 자체**다. `loadCompletableMission`을 쪼개 `getCurrentUserWithSkin`과 병렬로 돌리면 180ms를 벌지만, 그 함수가 단계 건너뛰기·남의 유형 미션·커리큘럼 밖 슬롯·presign 구멍을 한 곳에서 막는 **유일한 관문**이다. 쪼개면 읽지 않고 검증하는 호출부가 생길 수 있다. 180ms에 그 위험을 걸지 않았다.

그래서 줄이는 대신 기다리지 않게 했다.

| | 전 | 후 |
|---|---|---|
| 카운터 갱신 | 서버 응답 후 (2983ms) | **6ms** |
| 모달 닫힘 | 서버 응답 후 | **6ms** |
| 재조회 도착 | 3706ms | 3706ms (배경에서) |

강제 실패 주입(fetch를 400으로 가로챔): 4/5 → 5/5로 올라갔다가 4/5로 되돌아오고 서버 문구가 상단 배너에 뜬다. 카드의 체크도 함께 풀린다. 콘솔 에러 0건.

| 파일 | 역할 |
|---|---|
| `lib/missions/optimistic.ts` | 신규. 순수 함수 `applyCompletion(dto, missionId, completed)` |
| `scripts/check-optimistic.ts` | 신규. `npm run check:optimistic` 9건 |
| `app/missions/MissionDashboard.tsx` | 버튼 미션 요청을 모달에서 부모로 올리고 배너 추가 |

- **순수 함수로 뺀 이유** — 되돌리기가 있는 상태 변경은 화면 코드에 인라인으로 두면 검증할 수 없다. 실패 경로는 화면에서 재현하기 어렵고, 깨지면 사용자에게 "카운터가 -1이 됐다"로 나타난다. 단정 9건: 되돌리기 두 번에 음수 안 됨, 총계 초과 안 됨, 원본 불변, 없는 id 무시, 같은 상태면 원본 참조 그대로 반환
- **단계 해금과 `stages.current`는 일부러 계산하지 않는다.** `computeStageProgress()`의 몫이고 클라이언트에서 다시 구현하면 두 벌이 갈라진다. 해금은 재조회가 도착할 때(370ms 뒤) 반영된다
- **재화도 낙관적으로 올리지 않는다.** `calculateReward()`가 스킨 배율을 서버에서 걸어서 클라이언트 추측이 틀릴 수 있다. 사이드바는 `user-stats-changed`로 응답 후에 맞춘다
- **사진 미션은 그대로 블로킹이다.** Bedrock 판정 결과를 미리 알 수 없다. "검증 중..." 표시는 남긴다
- **요청을 부모로 올린 이유** — 체크를 즉시 보여주려고 모달을 먼저 닫으므로, 요청이 그 컴포넌트보다 오래 살아야 하고 실패 안내도 부모에 있어야 한다. 모달의 `completeError`는 사진 미션 전용으로 남았다
- 버튼 미션에서 `disabled={completing}`이 사실상 꺼졌다. 기다리지 않으므로 비활성화할 구간이 없다

### 판단 기준

`danluu.com/perf-opt` HN 스레드 최상위 댓글: *"많은 UI 조작에 대기 창이나 로딩 표시가 필요하다면 처음부터 블로킹을 기본 전제로 설계한 셈"*. 이 기준으로 보면 "완료 중..." 표시는 성능 문제의 **증상 표기**였다.

남은 블로킹 조작: 출석 수령(`disabled={claiming}`), 사진 미션(Bedrock), 챗봇.

## 종족색 중복 선언 제거 (2026-08-23)

`MissionDashboard.tsx`가 `CHARACTER_COLOR` · `CHARACTER_BG` · `CHARACTER_EMOJI`
맵 3개를 자체 선언하고 `typeCode.includes("HEALTH_EMOTION")`으로 세 갈래를 갈랐다.

두 가지가 문제였다.

- **`lib/types.ts:5`가 "색은 여기 한 곳에만 있다. 톤을 바꾸기로 하면 colorHex 3개만
  교체한다"고 적어 둔 약속을 깬다.** 이 파일이 그 3개(`#E8956A` `#6A95C8` `#7AAE82`)와
  이모지 3개를 복사해 갖고 있어서, 톤을 바꾸면 미션 화면만 옛 색으로 남는다
- **`includes()`가 필요 없었다.** `TypeCode`는 값이 정확히 3개인 enum이다
  (`prisma/schema.prisma:14`). 부분 일치가 필요한 접미사 붙은 코드는 존재하지 않는다.
  그리고 유형이 늘면 `else if` 사슬은 조용히 기본값(`cat`)으로 떨어진다

`app/pet/rest/page.tsx:14`에 **같은 패턴을 같은 이유로 이미 거절해 둔 기록**이 있었다
(`develop`의 원안이 그것이었다). 그때 `/pet/rest`만 고치고 `/missions`는 남겨 뒀다.

바꾼 것:

| 파일 | 변경 |
|---|---|
| `app/missions/MissionDashboard.tsx` | 맵 3개 → `TRIBE[typeCode]` 직접 색인. `TRIBE`에 대응 값이 없는 연한 배경색만 `TRIBE_BG`로 남았고 키가 `TypeCode`다 |
| `lib/missions/dashboard.ts` | `userTypeCode: string \| null` → `TypeCode \| null` |
| `scripts/check-optimistic.ts` | 픽스처 `"INDEPENDENT_LOW_INCOME_A"` → `"INDEPENDENT_LOW_INCOME"` |

**DTO를 좁힌 것이 실제로 값을 했다.** `TypeCode`로 바꾸자 컴파일러가 즉시
`check-optimistic.ts`의 `"INDEPENDENT_LOW_INCOME_A"`를 잡았다 — `_A` 접미사가 붙은
코드는 `TypeCode` 3개에도 `SubTypeCode` 8개에도 없다. DTO가 `string`이라 통과하고
있었던 것이다.

검증: `tsc`·`lint`·`build`·`check:optimistic` 9건·`npm run e2e` 75건 통과.
브라우저 실측(테스트 계정 = `INDEPENDENT_LOW_INCOME`) — 종족색 `#6A95C8`,
배경 `#D8E8FA`, 마스코트 🐱, 단계 `4 / 100 단계`, 가로 스크롤 0, 콘솔 에러 0.
변경 전과 같은 값이다.


## 복습 배치 계측 — 사다리 최상단에 최하단 미션이 온다 (2026-08-24, A 계측 / **미수정, B 판단 대기**)

**코드를 바꾸지 않았다.** `planCurriculum("HEALTH_EMOTION")`으로 300슬롯을 재생성해 잰
수치만 남긴다. 풀과 도입 순서는 손댈 것이 없고, 문제는 `pickReview()` 한 곳이다.

### 잘 되어 있는 것을 먼저 적는다

간격 반복이 우연이 아니다. 확장 간격(Leitner·SM-2 계열) 형태가 실제로 나온다.

```
이불 정리하기    1, 2, 4, 7, 12, 24, 50단계    간격 1 2 3 5 12 26
커튼 열기       1, 3, 6, 10, 20, 42, 90단계   간격 2 3 4 10 22 48
물 한 컵 마시기   1, 3, 5, 9, 17, 34, 72단계    간격 2 2 4 8 17 38
```

구간별 새 미션도 정확히 12개(공용 9 + 유형별 3)로 균일하고, 이전 구간 복습 비율도
33~37%로 고르다. "습관처럼 만드는 미션"이라는 요청에 맞는 구조다.

### 문제 1 — 복습 슬롯의 31%가 1구간 출신이다

복습 189슬롯의 출신 구간 분포:

| 출신 | 1 방 안에서 | 2 집 안 | 3 문 앞 | 4 동네 | 5 가게 | 6 더 멀리 | 7 한마디 | 8 대화·모임 | 9 관계 | 10 사회로 |
|---|---|---|---|---|---|---|---|---|---|---|
| 슬롯 | **54** | 32 | 21 | 20 | 13 | 8 | 8 | 8 | 7 | 6 |
| 비율 | **31%** | 18% | 12% | 11% | 7% | 5% | 5% | 5% | 4% | 3% |

원인은 `pickReview()`가 **순수 전역 LRU**라는 것이다(`lastSeen`이 가장 오래된 것을 고른다).
1구간 미션이 가장 먼저 도입되므로 항상 우선 선택된다. 난이도 개념이 없다.

10구간에서 이렇게 나타난다:

```
94단계  상담이나 면접 다녀오기(새) · 배우고 싶은 것 찾아보기(10구간) · 기지개 한 번(1구간)
98단계  한 달 계획 세우기(새)      · 할 수 있는 일 알아보기(10구간) · 양치하기(1구간)
90단계  먼저 연락하기(9구간)       · 일주일 기분 적어보기(새)      · 커튼 열기(1구간)
```

면접을 다녀오는 단계에서 슬롯의 33%가 `양치하기`다.

### 문제 2 — 습관이 필요한 쪽이 반복을 못 받는다

도입 구간별 평균 등장 횟수:

| 도입 구간 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 평균 등장 | **5.5회** | 3.7 | 2.8 | 2.7 | 2.1 | 1.7 | **1.7** | **1.7** | **1.6** | 1.4 |
| 1회만 나온 미션 | 0 | 0 | 0 | 0 | 2 | 4 | **4** | **4** | **5** | 9 |

`커튼 열기` 7회 대 `카페에서 주문하기` 2회다. 그리고 이런 것들은 **딱 한 번만** 나온다:

`'이거 주세요' 말해보기`(61) · `엘리베이터에서 인사`(68) · `안부 한 줄 보내기`(69) ·
`오래 못 본 사람에게 연락하기`(71) · `같이 밥 먹기`(79) · `모임에 두 번째로 가기`(81) ·
`도움 한 번 주기`(88) · `고맙다고 말하기`(89)

**거꾸로다.** 커튼 열기는 한 번 하면 이어지는 일이고, 사람에게 먼저 말을 거는 것이
반복이 필요한 일이다. 구조적 원인이 있다 — 늦게 도입된 미션은 확장 간격의 두 번째
복습(간격 3)까지만 커리큘럼 안에 들어오고 세 번째(간격 6~10)가 100단계를 넘어간다.
9구간 미션은 애초에 반복될 자리가 없다.

### 문제 3 — 10구간 복습에 사람이 없다

91~100단계의 복습 슬롯 9개 출신: 5·2·4·1·5·3·5·1·5구간.
**7~9구간(한마디 건네기·대화와 모임·관계 이어가기) 출신이 0개다.**
"사회로 한 걸음"을 걷는 구간에서 복습하는 것이 전부 혼자 하는 일이다.

### 제안 — 풀은 그대로 두고 선택기만 바꾼다

1. **복습 후보를 구간 거리로 제한한다.** "현재 구간에서 3구간 이상 떨어진 미션은
   후보에서 뺀다" 한 줄. 90단계의 후보가 6~9구간으로 좁혀지고, 1구간 미션은 1~4구간에서만
   돌아온다 — 습관 형성에 필요한 창은 그 안에 다 들어간다(`이불 정리하기`가 1·2·4·7·12·24에서
   이미 6회). 남는 복습 슬롯이 자동으로 최근 구간으로 간다. **이것만으로 세 문제가 다 줄어든다.**
2. 7~9구간 도입분에 복습 가중치를 준다. `m()` 시그니처에 필드 하나. 한 번만 나오는 13개가
   2~3회로 올라간다.
3. 10구간 복습을 7~9구간으로 못 박는다. `FINALE`이 100단계를 고정하는 것과 같은 방식.

### `check:curriculum`에 추가할 단정 3개

`auditCurriculum()`이 지금은 개수·중복만 본다. 아래를 넣으면 다음에 풀을 고쳐도 비율이
무너지지 않는다. **현재 값은 셋 다 위반이다.**

| 단정 | 현재 |
|---|---|
| 복습 슬롯 중 1구간 출신이 20% 이하 | **31%** |
| 7~9구간 미션은 최소 2회 등장 | **13개 위반** |
| 10구간 복습에 6구간 이전 출신 없음 | **9개 전부 위반** |

### 주의

`prisma/seed/curriculum.ts`를 고치면 `npm run db:seed`로 공유 DB의 `Mission` 909행을
다시 써야 한다. 마이그레이션은 아니지만 공유 DB 쓰기다 — 혼자 돌리지 말고 알린 뒤 한다.
