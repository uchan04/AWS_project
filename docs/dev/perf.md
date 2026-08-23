# 성능 개발 문서

`improve/service-quality` 브랜치. 2026-08-23.

측정 없는 최적화는 하지 않는다. 이 문서는 **무엇을 어떻게 재봤는지**를 남긴다 —
다음 사람이 같은 방법으로 다시 재서 회귀를 잡을 수 있어야 한다.

## 현재 상태

- 완료: 측정 도구 확립, 병목 3건 식별, 3건 전부 수정 + 전후 실측
- 완료: **4번째 병목 — prepare 왕복 × 연결 수. `/missions` 743ms → 376ms** (아래 "고친 것 4번째" 절). 재측정 스크립트 12개를 `scripts/perf-*`로 남겼다
- 완료: **5번째 — 쓰기 경로. 미션 완료 왕복 8→7회, 체감 1.6초 → 6ms. 좋아요도 같은 패턴**
- 미착수: `/community` 첫 페이지 쿼리(현재 549ms, 이미 서버 렌더라 왕복 구조가 최선), API 응답 캐시

## 측정한 물리량 — 이게 전부의 근거다

**RDS가 us-east-1이고 접속은 한국에서 한다. 쿼리 왕복 1회 = 180ms.**

이 하나로 거의 모든 수치가 설명된다. 응답 시간은 읽은 행 수나 SQL 복잡도가 아니라
**순차 왕복 횟수**의 함수다. 인덱스를 더 붙이거나 `select`를 좁히는 것으로는 거의
움직이지 않고, 왕복을 하나 없애면 정확히 180ms가 빠진다.

확인 방법: 같은 화면에서 쿼리 개수만 다른 두 경로를 재보면 차이가 180ms의 정수배로 나온다.

주의할 것 두 가지:

- **Prisma의 `include`는 to-one 관계도 쿼리를 따로 낸다.** `include: { activePetSkin: true }`
  한 줄이 왕복 1회다. JOIN이 아니다. (`relationJoins` 프리뷰 기능을 켜면 달라지지만 켜지 않았다)
- **`Promise.all`로 감싸지 않은 두 `await`는 순차다.** 서로를 필요로 하지 않는 쿼리
  둘을 순서대로 쓰면 그냥 360ms다. 실제로 홈에서 이 실수가 있었다(아래 3번).
- **`Promise.all`로 감쌌다고 왕복 1회가 보장되지는 않는다.** 2026-08-23에 이 모형이
  틀렸음을 실측으로 확인했다. Postgres는 처음 보는 SQL 문에 prepare 왕복을 한 번 더
  쓰고, 그 캐시가 **연결마다** 따로다. 병렬 N개는 서로 다른 연결 N개에 흩어지므로
  풀 상한이 25면 채워야 할 조합이 (문 개수 × 25)가 되고, 저트래픽 앱은 그 예열을
  끝내지 못한다. 그래서 병렬 묶음의 벽시계가 왕복 1~4회 사이를 계속 오간다.
  **그래서 "쿼리 개수"는 병렬이어도 여전히 비용이다.** 아래 4번째 절.

## 측정 방법 — 그대로 재현할 수 있다

프로덕션 빌드로만 잰다. `next dev`는 요청마다 컴파일해서 숫자가 의미 없다.

```bash
npm run build
npx next start -p 3101
```

`.claude/launch.json`에 이 프로덕션 설정이 들어 있다(`preview_start`용).

### 서버 응답 시간 (TTFB)

```bash
# 로그인해서 쿠키를 받아둔다
curl -s -c /tmp/ck.txt -X POST http://localhost:3101/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@welli.local","password":"welli-test-1234"}'

# 12회 재서 중위값을 본다. 첫 1~2회는 연결 풀이 차가워서 버린다
for i in $(seq 1 12); do
  curl -s -b /tmp/ck.txt -o /dev/null -w '%{time_total}\n' http://localhost:3101/missions
done | sort -n
```

**중위값을 쓴다.** 평균은 꼬리 한 건에 끌려간다. 최솟값도 같이 본다 — 최솟값이
안 내려가면 구조가 안 바뀐 것이고, 중위값만 내려간 건 운이다.

### 브라우저 지표 (LCP / CLS / long task)

`PerformanceObserver`에 `buffered: true`를 줘야 관찰자를 붙이기 전에 발생한
이벤트도 잡힌다. 이걸 빼면 LCP가 항상 비어 있게 나온다.

```js
new PerformanceObserver((list) => { /* ... */ })
  .observe({ type: "largest-contentful-paint", buffered: true })
// layout-shift, longtask도 같은 방식
```

CLS는 `layout-shift` 엔트리의 `value` 합이고, 원인을 찾을 때는 `sources`의
노드를 본다. `hadRecentInput: true`인 것은 세지 않는다(사용자 입력에 의한 이동).

클라이언트 fetch가 실제로 없어졌는지는 `PerformanceObserver`의 `resource` 타입에서
`initiatorType === "fetch"`를 세면 된다. 0건이어야 한다.

### 기준선 (2026-08-23 시점, 시장 기준)

Core Web Vitals의 "good" 임계값을 그대로 쓴다. 데모 프로젝트라 목표를 낮춰 잡을
이유가 없다 — 심사자도 이 숫자로 본다.

| 지표 | 목표 |
|---|---|
| LCP | 2500ms 이하 |
| CLS | 0.1 이하 |
| INP | 200ms 이하 |

## 고친 것 3건

### 1. `getCurrentUserWithSkin()`의 유저 행 재조회 — `lib/auth.ts`

같은 행을 두 번 읽고 있었다. `getCurrentUser()`가 유저를 읽고(왕복 1),
그 다음 줄이 `include`와 함께 같은 행을 다시 읽었다(왕복 2 — 유저 + 스킨).
합쳐서 3회.

`activePetSkinId`는 `User`의 컬럼이라(`prisma/schema.prisma:113`) 첫 조회로 이미 손에
있다. 스킨만 따로 읽으면 왕복 2회로 끝나고, 진단 전 유저(스킨 없음)는 1회다.

**왜 이게 가장 컸는가**: `app/layout.tsx:83`이 사이드바를 그리려고
`getSidebarProfile()` → `getCurrentUserWithSkin()`을 **매 페이지 요청마다** 부른다.
한 곳을 고쳐서 8개 화면 전부가 180ms 빠졌다.

반환 형태는 `include` 버전과 같다. 스킨 id가 지워진 행을 가리키는 경우에도
`include`가 `null`을 줬으므로 동작이 같다.

| 경로 | 이전 | 이후 |
|---|---|---|
| `/pet` | 728ms | **552ms** |
| `/settings` | 551ms | **370ms** |
| `/pet/cosmetics` | 538ms | **371ms** |
| `/pet/skins` | 539ms | **369ms** |
| `/api/pet` | 540ms | **361ms** |

### 2. 미션·홈의 클라이언트 fetch — `app/missions/page.tsx`, `app/page.tsx`

`app/missions/page.tsx`는 `return <MissionDashboard />` 한 줄이었고, 데이터는
클라이언트가 마운트된 뒤 `useEffect`의 `fetch("/api/missions")`로 가져왔다.
순서가 이렇게 된다:

```
HTML 도착(TTFB) → JS 다운로드·실행 → fetch 시작 → 응답 → 첫 미션 렌더
```

같은 코드베이스의 `/community`는 서버 렌더다. 렌더 방식만 다른 두 화면을 재보면:

| 화면 | 렌더 방식 | TTFB | LCP |
|---|---|---|---|
| `/missions` | 클라이언트 fetch | 539ms | **4324ms** |
| `/community` | 서버 렌더 | 901ms | **1332ms** |

TTFB가 더 느린 쪽이 LCP는 3배 빨랐다. 서버에서 조립해 내려보내면 왕복이
임계 경로에서 통째로 빠진다.

서버에서 **같은 함수를 부른다** — `getCurrentUser` → `ensureMissionReset` →
`buildDashboard`. `GET /api/missions`와 조립 순서가 같다. 그 라우트는 지우지 않았다:
미션을 완료한 뒤 목록을 다시 읽는 데 계속 쓴다. 로직을 복사하지 않고 같은 함수 둘을
부르므로 두 경로의 값이 갈라질 수 없다.

`DashboardDTO`는 `Date` 없이 원시값만 담고 있어서 RSC 경계를 그대로 넘어간다 —
API가 돌려주는 JSON과 바이트가 같다. 변환 계층이 필요 없었다.

클라이언트는 `initial`/`initialError` prop을 받아 초기 state로 쓰고, 이펙트에서
early-return 한다. **이 early-return이 없으면 서버 렌더를 해 두고도 마운트 직후
왕복 1회를 그대로 낸다** — 임계 경로에서 안 빠진다.

prop을 생략하면(`undefined`) 예전처럼 스스로 불러온다. 기존 호출부를 깨지 않는다.

| 지표 | 이전 | 이후 |
|---|---|---|
| `/missions` LCP | 4324ms | **856ms** |
| `/missions` 클라 fetch | 1건 | **0건** |
| `/missions` CLS | 0.0001 | 0 |

### 3. 홈의 순차 왕복과 CLS — `app/page.tsx`, `app/HomeDashboard.tsx`

홈을 서버 렌더로 옮긴 첫 판본이 **오히려 느려졌다**(551 → 912ms).
`getCurrentUserWithSkin()`이 `buildDashboard` 앞에 순차로 붙어서다. 둘은 서로를
필요로 하지 않으므로 `Promise.all`로 묶었다.

| | 시간 |
|---|---|
| 순차 | 912ms |
| 병렬 | **728ms** |

`Promise.all`에 그냥 넣으면 안 됐다 — **하나만 깨져도 전체가 거부**되므로 스킨 읽기
실패가 홈 전체를 에러 화면으로 만든다. 전에는 그게 `try/catch` 안이었다. 마스코트
그림 하나이고 이모지 폴백이 있으니 `.catch(() => null)`로 삼킨다.

CLS도 같이 잡혔다. 이전 실측: **CLS 0.2807**, 밀림 1건, 발생 시각 2280ms —
`fetch`가 끝난 그 시점이고 원인 노드가 `DIV.hm-home__cards` · `A.hm-row` ·
`H1.hm-home__name`이었다. "오늘의 나" 카드가 없던 자리에 끼어들어 아래를 전부
밀어냈다. HTML에 처음부터 들어 있으면 밀어낼 것이 없다.

**두 번째 CLS 원인**은 인사말이었다. `greeting`은 브라우저 시각으로 정해야 해서
(서버 시각으로 렌더하면 하이드레이션이 어긋난다) 첫 렌더에 빈 문자열이고, 그러면
그 `<p>`의 높이가 0이다. 값이 들어오는 순간 한 줄만큼 아래가 밀린다.
`{greeting || " "}`로 줄 높이를 미리 잡았다. 일반 공백은 JSX에서 잘리므로
반드시 U+00A0이어야 한다.

| 지표 | 이전 | 이후 |
|---|---|---|
| `/` CLS | 0.2807 | **0** (밀림 0건) |
| `/` LCP | 804ms | 1148ms (`IMG.hm-home__mascot`) |
| `/` 클라 fetch | 1건 (1447ms) | **0건** |

LCP가 늘어난 것은 회귀가 아니다. 이전의 804ms는 **미션 카드가 아직 없는 화면**의
LCP였다 — 잴 대상이 덜 그려진 상태다. 1148ms는 완성된 화면의 값이고, 그 시점 이후로
레이아웃이 움직이지 않는다. 목표 2500ms 안이다.

### 4. Bedrock 타임아웃 — `lib/bedrock.ts` (신규)

성능이라기보다 **최악의 경우 응답 시간**이다. `BedrockRuntimeClient`를 만드는 곳이
4군데였고 어디에도 타임아웃이 없었다. SDK 기본값은 **요청 타임아웃 없음 + 재시도 3회**라,
Bedrock이 응답하지 않으면 요청이 그 자리에 매달린다. 사진 판정 · 주제 추천 ·
판정 근거 3줄은 모두 화면을 막는 호출이다.

리전 해석도 갈라져 있었다 — 3곳은 `BEDROCK_REGION || "us-east-1"`, 1곳만
`BEDROCK_REGION || AWS_REGION || "us-east-1"`.

`lib/bedrock.ts` 하나로 모았다. 단발 호출 20초 / 스트리밍은 청크 사이 유휴 60초,
재시도 2회.

구현 주의점 두 가지:

- `requestHandler`는 **객체 리터럴로 넘긴다.** SDK v3의 타입이
  `Record<string, unknown>`을 허용한다. `@smithy/node-http-handler`를 직접 import하면
  전이 의존성에 묶여 SDK 업그레이드 때 조용히 깨진다.
- **`requestTimeout`만 쓴다.** `connectionTimeout`은 `NodeHttpHandler`에만 있고
  `NodeHttp2Handler`에는 없다. `bedrock-runtime`의 기본 핸들러가 후자다.

실측: `/api/community/topics`가 실패까지 2.2~2.4초(정상 경로). 상한이 없던 이전에는
무응답 시 걸리는 시간에 상한이 없었다.

## 고친 것 4번째 — prepare 왕복 × 연결 수 (2026-08-23)

`/missions`가 앞의 3건을 고친 뒤에도 정상 상태 TTFB 743ms였다. 왕복 1회가 180ms이므로
왕복 4회분이다. 그런데 `buildDashboard()`는 6개 쿼리를 이미 `Promise.all`로 내고 있었다.
위 모형("순차 왕복 횟수의 함수")대로면 왕복 1회여야 한다. 모형이 틀렸다는 뜻이므로
추측하지 않고 후보를 하나씩 각하했다.

계측 스크립트는 전부 읽기 전용이고, `lib/prisma.ts`를 고치지 않으려고 각자 자체
`PrismaClient`를 만든다.

| 후보 | 실측 | 판정 |
|---|---|---|
| 링크·네트워크 | `SELECT 1` 40회가 40/40 전부 177±4ms | 각하. 링크는 완벽하다 (`perf-rtt.ts`) |
| 연결 풀 지연 생성 | raw 6개 동시 묶음이 1회차 9.2배, 이후 12회 연속 1.0배 · 연결 수 34 고정 | 1회차만. 정상 상태 원인 아님 (`perf-converge.ts`) |
| N+1 / 관계 필터 펼침 | ORM 쿼리마다 SQL **정확히 1문**. `mission: { scope: ... }`는 `LEFT JOIN` 하나로 나간다 | 각하 (`perf-sqlcount.ts`) |
| 페이로드 크기 | STAGE 300행을 `{id, stage}`로 줄여 80.8KB → 16.7KB(79% 감소)했으나 벽시계는 2% **증가** | 각하. 내 첫 가설이 틀렸다 (`perf-dashboard-ab.ts` 초판) |
| `connection_limit` 조정 | 1 → 1086ms(=6×181, 완전 직렬) · 2 → 540ms · 5 → 541ms · 10 → 534ms · **기본 25 → 365ms** | 각하. 낮추면 그만큼 직렬화된다. **E 소유 `DATABASE_URL`은 손댈 이유가 없다** (`perf-limit.ts`) |
| **prepare 왕복 × 연결 수** | 처음 보는 문을 내는 연결은 왕복 2회(362ms), 두 번째부터 180ms 고정 | **← 원인** (`perf-prepare.ts`) |

결정적 증거는 `perf-sqlcount.ts`가 한 `Promise.all` 안의 engine duration을
**179 / 352 / 353 / 354 / 358 / 717ms로 혼재하게** 찍은 것이다. 같은 순간에 나간 6개가
어떤 것은 왕복 1회, 어떤 것은 2회, 하나는 4회를 썼다. 문마다·연결마다 prepare 캐시
적중 여부가 달랐다는 뜻이다.

레버는 **문의 개수**뿐이었다(연결 수는 각하됐고 페이로드는 원인이 아니었다).
그리고 6개 중 2개는 사용자와 무관했다 — 미션 카탈로그는 시드 스크립트로만 바뀌는
불변 데이터인데 요청마다 300행을 본문까지 다시 읽고 있었다.

`lib/missions/catalog.ts` 신규. TTL 5분, 진행 중 요청 합침(Promise를 캐시해 캐시가 빈
동시 요청 N개가 같은 쿼리를 N번 내지 않게), 실패 시 즉시 무효화.

- `buildDashboard()` DB 쿼리 6개 → 4개, 카탈로그 80.8KB → 0KB
- `getStageProgress()` DB 쿼리 2개 → 1개 (완료 API 경로)

**전후** — 같은 세션에서 A(전)와 B(후)를 회차마다 순서를 뒤집어 12회 (`perf-dashboard-ab.ts`)

```
buildDashboard  p50 542ms -> 182ms (66% 감소). 왕복 정확히 1회로 수렴 고정
                A는 끝까지 363~729ms 진동, B는 6회차부터 182ms에 고정
DTO 동등성      현재 단계·창 안 미션 수·일일 완료 전부 일치
```

**정상 상태 TTFB** — `bash scripts/perf-ttfb.sh 3101 10`

| 경로 | 전 | 후 | |
|---|---|---|---|
| `/missions` | 743ms | **376ms** | 49% 감소. 진동 363~729ms → 374~379ms로 안정 |
| `/api/missions` | 716ms | **367ms** | 49% 감소 |
| `/` | 730ms | **380ms** | 48% 감소 |
| `/pet` | 375ms | 376ms | 변화 없음 (미션 경로 미경유) |
| `/community` | 375ms | 370ms | 변화 없음 |
| `/settings` | 375ms | 375ms | 변화 없음 |
| `/api/pet` | 358ms | 367ms | 변화 없음 |
| `/api/community/posts` | 534ms | 549ms | 변화 없음 |

376ms는 왕복 2회다 — `getCurrentUser()` 1회 + `buildDashboard()` 1회. 이 둘은 순서
의존이므로(사용자 행을 읽어야 대시보드를 만든다) 현재 구조의 바닥이다.

계측 스크립트 (`npx tsx scripts/<파일>`, 전부 읽기 전용)

| 파일 | 무엇을 가르는가 |
|---|---|
| `perf-rtt.ts` | 왕복 1회의 분포. 링크가 원인인지 **먼저** 배제한다 |
| `perf-probe.ts` | 쿼리별 시간·행수·직렬화 KB·왕복 환산 |
| `perf-pool.ts` | 병렬이 왕복 1회로 끝나는지, 풀 지연 생성인지 |
| `perf-converge.ts` | 같은 묶음을 반복하면 수렴하는지 + DB 쪽 연결 수 |
| `perf-sqlcount.ts` | ORM 쿼리 하나가 SQL 몇 문으로 펼쳐지는지 (N+1 판별) |
| `perf-prepare.ts` | prepare 왕복인지 ORM 고정 비용인지 |
| `perf-limit.ts` | `connection_limit`별 병렬 벽시계 |
| `perf-conncheck.ts` | 공유 DB 연결 상한·사용량. 예열 개수를 정하기 전에 본다 |
| `perf-missions-path.ts` | `/missions` 서버 경로를 단계별로 쪼갠다 |
| `perf-dashboard-ab.ts` | `buildDashboard` 전후를 한 세션에서 번갈아 |
| `perf-ttfb.sh` | 경로별 정상 상태 TTFB. **최종 지표** |
| `perf-coldstart.sh` | 콜드 스타트 첫 요청 비용 |

계측 중에 각하한 것 둘 — 기록해 두는 이유는 다음 사람이 같은 길을 다시 가지 않도록:

- **콜드 풀 예열 (`instrumentation.ts`)** — `/pet` 1차 ~740ms → 2차 ~375ms로 예열
  비용이 왕복 2회분 있는 것은 재현했다. 그런데 `max_connections`가 79(사용 가능 76)이고
  여유가 44뿐이다(`perf-conncheck.ts`). 5인이 각자 로컬 서버를 띄우는데 Prisma 기본
  상한이 클라이언트당 25다 — 25×5 = 125 > 76. 공유 DB에 연결 압력을 더할 수 없어 포기했다
- **`/api/community/topics` 2205ms** — DB가 아니라 **Bedrock LLM 호출**이다
  (`lib/community/topics.ts`의 `ConverseCommand`). 라우트가 이미 실패를 삼키고
  `{ topics: [] }`를 돌려 고정 문구로 폴백한다. 성능 문제로 볼 것이 아니다

**보고만 하고 바꾸지 않은 것** — `DATABASE_URL`에 `connection_limit`이 없어 Prisma가
클라이언트당 25개를 연다. 인스턴스가 사용 가능 76개인 공유 DB에서 5인 + Amplify가
동시에 붙으면 고갈될 수 있다. 다만 위에서 재본 대로 값을 낮추면 그만큼 직렬화되어
느려진다(1 → 1086ms). **트레이드오프이고 E 소유 공유 인프라라 팀 결정 사항이다.**

## 고친 것 5번째 — 쓰기 경로. 줄이는 대신 기다리지 않게 했다 (2026-08-23)

읽기 경로만 재고 있었다. 쓰기 경로를 재보니 4배 느렸다.

| 경로 | 실측 | 왕복 |
|---|---|---|
| `POST /api/missions/:id/complete` | 1466ms | 8.1회 |
| `POST /api/community/posts/:id/like` | 1281ms | 7.1회 |
| (참고) `/missions` 읽기 | 376ms | 2.1회 |

### 단계별 분해 — `scripts/perf-write-path.ts`

기준선(왕복 1회) 175ms 기준. 라우트를 봐서는 어느 단계가 몇 회를 쓰는지 모른다 —
**트랜잭션 안의 `await` 하나하나가 각각 왕복 1회**이기 때문이다.

```
mission.findUnique (loadCompletable 안)      176ms  1.0회
getStageProgress (해금 확인)                  178ms  1.0회
loadCompletableMission 전체                   353ms  2.0회
completeMission — 행을 다시 읽음(전)           702ms  4.0회
completeMission — 행을 넘겨받음(후)            527ms  3.0회
합계 (라우트 본문, 후)                          880ms  5.0회
```

`getCurrentUserWithSkin()`이 라우트 첫 줄에 왕복 2회를 더 쓴다. 2 + 2 + 4 = 8 —
curl로 잰 8.1회와 정확히 맞는다.

이 스크립트는 **이미 완료한 미션만** 쓴다. `userMission.create`가 P2002로 되돌아가므로
공유 개발 DB가 바뀌지 않는다. 완료한 단계 미션이 없으면 실행을 거부한다.

### 수정 1 — 중복 조회 제거 (왕복 8 → 7회)

`completeMission()`이 호출부가 방금 읽은 `mission` 행을 다시 읽고 있었다.
호출부 3곳 모두 직전에 같은 행을 읽는다 — `loadCompletableMission()`은 검증하려고,
`completeMissionByCode()`는 code로 id를 찾으려고.

optional `mission` 파라미터로 넘겨받되 **id가 어긋나면 다시 읽는다.** 이 검사가 없으면
남의 미션 행이 들어와 엉뚱한 보상이 나간다. 넘기지 않으면 예전대로 동작한다.

```
1466ms 왕복 8.1회  ->  p50 1253ms 왕복 7.0회   (-213ms)
진동 1461~1652ms   ->  1247~1257ms
```

### 수정 2 — 낙관적 갱신. 체감 1.6초 → 6ms

남은 왕복은 코드로 더 줄일 몫이 거의 없다. 트랜잭션의 BEGIN·COMMIT이 각각 왕복 1회지만
**그게 보상 지급의 원자성 자체**다. `loadCompletableMission`을 쪼개 병렬로 돌리면 180ms를
벌지만 그 함수가 단계 건너뛰기·남의 유형 미션·커리큘럼 밖 슬롯·presign 구멍을 한 곳에서
막는 유일한 관문이다. 쪼개면 읽지 않고 검증하는 호출부가 생길 수 있다.

그래서 **줄이는 대신 기다리지 않게** 했다.

프로덕션 빌드 · 브라우저 실측 (MutationObserver로 DOM이 바뀐 시점):

| | 전 | 후 |
|---|---|---|
| 카운터 갱신 | 서버 응답 후 (2983ms) | **6ms** |
| 모달 닫힘 | 서버 응답 후 | **6ms** |
| 재조회 도착 | 3706ms | 3706ms (배경에서) |

강제 실패 주입(fetch를 400으로 가로챔): 4/5 → 5/5로 올라갔다가 4/5로 되돌아오고
서버 문구가 상단 배너에 뜬다. 카드의 체크도 함께 풀린다. 콘솔 에러 0건.

- `lib/missions/optimistic.ts` — 순수 함수 `applyCompletion(dto, missionId, completed)`.
  되돌리기가 있는 상태 변경을 화면 코드에 인라인으로 두면 검증할 수 없다.
  `npm run check:optimistic` 9건이 단정한다 (되돌리기 두 번에 음수 안 됨, 총계 초과 안 됨,
  원본 불변, 없는 id 무시 포함)
- **단계 해금과 `stages.current`는 일부러 계산하지 않는다.** `computeStageProgress()`의
  몫이고 두 벌로 구현하면 갈라진다. 재조회가 도착할 때 반영된다
- **재화도 낙관적으로 올리지 않는다.** `calculateReward()`가 스킨 배율을 서버에서 걸어서
  클라이언트 추측이 틀릴 수 있다. 사이드바는 `user-stats-changed`로 응답 후에 맞춘다
- **사진 미션은 그대로 블로킹이다.** Bedrock 판정 결과를 미리 알 수 없다
- 요청을 모달에서 부모로 올렸다. 모달을 즉시 닫으므로 요청이 그 컴포넌트보다 오래 살아야
  하고, 실패 안내도 부모에 있어야 한다

### 수정 3 — 좋아요 낙관적 갱신

같은 패턴. 하트를 즉시 뒤집고, 응답이 오면 서버가 준 `likeCount`로 맞추고, 실패하면 되돌린다.

- `disabled`를 뗐다 — 이미 뒤집혀 보이는 버튼이 회색이면 고장으로 읽힌다
- 대신 요청이 떠 있는 동안의 탭은 무시한다. 서버 토글은 현재 DB 상태를 보고 뒤집으므로
  두 요청이 겹치면 어느 쪽이 이겼는지 알 수 없다
- `aria-pressed`를 붙였다

**브라우저 실측을 못 했다.** 프리뷰 창에서 `/community`의 Suspense 경계가 하이드레이션되지
않는다(`$RC("B:0","S:0")`를 직접 불러도 fiber가 붙지 않는다). 서버 HTML에는 목록이 다 들어
있다 — curl로 200 / 553ms / 39KB, 글 제목까지 확인했다. 앱 문제가 아니라 프리뷰 창 문제다.
미션 쪽 같은 패턴은 6ms로 측정됐다.

### HN 스레드에서 가져온 판단 기준

danluu.com/perf-opt 스레드의 최상위 댓글: *"많은 UI 조작에 대기 창이나 로딩 표시가
필요하다면 처음부터 블로킹을 기본 전제로 설계한 셈"*. 이 기준으로 보면 "완료 중...",
"수령 중..." 같은 표시는 성능 문제의 **증상 표기**였다. 미국 밖 사용자에게 왕복마다
300ms가 붙는다는 지적도 그대로 우리 상황이다(us-east-1, 180ms).

남은 블로킹 조작: 출석 수령(`disabled={claiming}`), 댓글 작성(서버 id·친밀도가 필요),
사진 미션(Bedrock 판정), 챗봇.

## 같이 고친 버그 1건

`app/missions/MissionDashboard.tsx`의 "다시 시도" 버튼이 아무 일도 하지 않았다.
`loadDashboard()`가 성공해도 `error` state를 비우지 않아서, 에러 화면 분기가
`dashboard` 분기보다 위에 있는 탓에 새로 받아온 데이터를 계속 가렸다.
`setError(null)`을 앞에 뒀다.

측정하다 발견한 것이지 성능과는 무관하다.

## 결정한 것과 이유

- **`GET /api/missions`를 지우지 않았다.** 서버 렌더로 옮겼어도 미션 완료 후 재조회에
  쓴다. 페이지와 라우트가 같은 함수(`buildDashboard`)를 부르므로 중복이 아니다
- **`initial` prop은 optional이다.** 생략하면 예전 동작(스스로 fetch)이다. 기존
  호출부와 테스트를 깨지 않는다
- **인사말을 서버로 옮기지 않았다.** 서버 시각으로 렌더하면 시간대가 다른 사용자에게
  하이드레이션 불일치가 난다. 자리만 미리 잡는 쪽이 맞다
- **`lib/prisma.ts`는 건드리지 않았다.** 커넥션 풀 설정을 만지는 것은 왕복 횟수를
  줄이는 것보다 효과가 작고 위험이 크다
- **인덱스를 추가하지 않았다.** 병목이 행 수가 아니라 왕복 횟수라는 것이 측정으로
  확인됐다. 인덱스로는 180ms가 안 움직인다
- **새 의존성 0개.** 측정은 `curl`과 브라우저 `PerformanceObserver`로 했고, 측정용
  스크립트는 `.next/`(gitignore) 안에 임시로 뒀다

## 검증

- `npx tsc --noEmit` 통과
- `npm run lint` 통과 (에러 0 · 경고 0)
- `npm run build` 통과. `/missions`가 라우트 표에서 `ƒ`(dynamic)로 바뀐 것 확인
- `npm run e2e` **75건 통과 · 0건 실패** — 기준선과 같다 (4번째 수정 후 다시 실행)
- `npm run check:pet` `check:reward` `check:community` `check:curriculum` `check:diagnosis`
  `check:safety` `check:auth` `check:optimistic` 8종 전부 통과 (`check:optimistic` 9건)
- `/missions`·`/` 초기 HTML을 접근성 트리로 확인: 출석 캘린더 7일 그리드, 일일 미션
  5개와 씨앗 보상, 단계 미션 2/100과 해당 3개, 진행률 바, 사이드바 재화 —
  전부 서버 HTML에 들어 있다

## 남은 것

- `/community` 549ms. 이미 서버 렌더이고 왕복 구조가 최선에 가깝다. 더 줄이려면
  목록 쿼리와 사이드바 쿼리를 합쳐야 하는데 소유 경계를 넘는다
- `/api/missions` p95를 라우트 단독으로 다시 재지 않았다. 화면 경로에서 빠졌으므로
  급하지 않다
- 출석 수령과 댓글 작성은 아직 블로킹이다. 출석은 낙관적으로 만들 수 있고(서버가 주는 값이
  cycleDay·재화뿐), 댓글은 서버 id가 필요해 임시 id 처리가 붙는다
- 좋아요 낙관적 갱신의 브라우저 실측이 빠져 있다. 프리뷰 창의 Suspense 하이드레이션 문제라
  다른 창에서 한 번 눌러보면 끝난다
- RDS 리전이 us-east-1인 것 자체가 최대 병목이다. ap-northeast-2로 옮기면 왕복이
  180ms → 10ms대가 된다. **공유 DB라 손대지 않는다** — 팀 결정 사항이다
