# 미션 시스템 개발 문서 (담당 B)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 4절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 미션 조회 API, 일반·이벤트 완료, 출석, S3 업로드, Bedrock 사진 판정, 단계 해금, streak, UI 연결
- 완료: **단계 3개 → 100개 확장 (2026-08-22, A).** 아래 "100단계 커리큘럼" 절. `SPEC.md` 4절도 같이 다시 썼다
- 완료: **"오늘 이거 하나만" 집중 카드 (2026-08-23)** — 아래 절
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
- **옛 시드가 만든 단계당 4번째 미션 9개가 실 DB에 남아 있다.** 지우지 않고 **코드에서 배제한다**(공유 DB는 손대지 않기로 했다). 조회 3곳(`catalog.ts:71`, `dashboard.ts:108`, `stages.ts:98`)이 `order <= MISSIONS_PER_STAGE`로 거르고, 완료 경로도 2026-08-22에 같은 조건을 갖췄다(아래). `scripts/prune-orphan-stage-missions.ts`는 남겨 두지만 실행하지 않는다

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
