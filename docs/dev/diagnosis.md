# 유형 진단 개발 문서 (담당 A)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 2·3·4절, 규칙은 `CLAUDE.md`.

**이 문서의 4~7장은 확정된 실행 스펙이다.** 값을 새로 정하지 말고 그대로 옮겨 구현한다. 값을 바꿔야 할 이유를 발견하면 먼저 사용자에게 알린다.

## 현재 상태
- 완료: 없음
- 진행 중: 1단계 (미션 콘텐츠, 판정 로직)
- 미착수: 진단 화면, Bedrock 호출 2종, 결과 화면, 재진단

## 구현한 파일
- `lib/types.ts` — 종족·형용사 매핑, 기본 닉네임, 성장 곡선 상수 (골격 완료)
- `prisma/seed/missions.ts` — 일일 5개 완료, 단계 미션 1개(형식 예시). 36개 미작성

---

## 1. 작업 순서

DB가 아직 없다(`DATABASE_URL` 미공유). 그래서 **DB가 필요 없는 것부터 한다.** 미션 콘텐츠와 판정 로직은 순수 파일·순수 함수라 지금 당장 끝낼 수 있고, 마침 이 둘이 팀에서 가장 급한 항목이다.

### 1단계 — DB 없이 (8/15)

1. **미션 콘텐츠 36개** (`prisma/seed/missions.ts`) — 최우선. B의 미션 시스템과 C의 펫이 이 데이터를 기다린다. 규칙은 7장
2. **6문항 정의** (`lib/diagnosis/questions.ts`) — 4장 표를 그대로 옮긴다
3. **판정 함수** (`lib/diagnosis/classify.ts`) — 5장 계약대로. 순수 함수, LLM 없음
4. **스냅샷 테스트 18개** (`scripts/check-diagnosis.ts`) — 6장 표를 그대로 옮긴다

### 2단계 — DB 연결 후 (8/16)

5. 진단 화면 6문항 + 진행률 바 — 선택지 버튼만으로 LLM 없이 동작 (8장)
6. 진단 완료 API (8장)
7. 결과 화면 — 종족·컬러·기본 닉네임 + 닉네임 즉시 변경

### 3단계 — Bedrock 확인 후 (8/17)

8. 자유 입력 → 선택지 코드 변환 (tool use, 실패 시 버튼 폴백)
9. 판정 근거 3줄 요약 → `DiagnosisSession.reasonText`
10. 질문 문장 다듬기 + 다음 문항 프리페치 — **A 담당분 중 가장 먼저 자를 항목**

### 4단계 (8/18)

11. 재진단 — 8장의 완료 API를 그대로 재사용한다

---

## 2. 결정한 것과 이유

- 판정은 100% 코드. LLM은 질문 문장 다듬기와 자유 입력 enum 변환만 담당
- 형용사는 6번 문항 4지선다에 1:1 매핑. `lib/types.ts`의 `ADJECTIVE_BY_CHOICE` 상수 테이블
- 진단 로직은 `lib/diagnosis/` 하위에 새로 만든다. `lib/types.ts`는 4명이 import하는 공유 파일이라 문항·판정 코드까지 넣으면 충돌 위험이 커진다
- 화면은 선택지 버튼만으로 먼저 완성한다. Bedrock이 늦어져도 진단 플로우 전체가 동작해야 한다
- 스냅샷 테스트는 테스트 프레임워크 없이 `scripts/check-reward.ts`와 같은 방식(`node:assert`)으로 만든다
- **6장의 기대값을 먼저 확정한 뒤 판정 함수를 구현한다.** 순서를 뒤집으면 구현 결과를 그대로 기대값으로 박게 되고, 테스트가 아무것도 검증하지 않는다. 이 테스트가 발표에서 제시할 정확도 근거다

## 3. 막힌 것
- `DATABASE_URL` 미공유 (E 대기). 1단계 작업에는 영향 없음
- Bedrock 연결 확인 미완 (E 대기). 3단계에서 필요

---

## 4. 문항 스펙 (확정)

축은 `housing` / `health` / `employment` 3개. Q6은 형용사 전용이라 축이 없다.

`weight`는 **그 답변이 해당 축의 어려움을 얼마나 강하게 나타내는가**다. 0 = 신호 없음, 1 = 약한 신호, 2 = 강한 신호.

### Q1 — 지금 누구와 함께 살고 있나요? (housing)

| 선택지 코드 | 표시 문구 | weight | 비고 |
|---|---|---|---|
| `Q1_FAMILY` | 가족과 함께 살아요 | 0 | **이 답이면 `FAMILY_LIVING` 확정** |
| `Q1_ALONE` | 혼자 살아요 | 2 | |
| `Q1_SHARE` | 친구나 룸메이트와 살아요 | 1 | 비가족 동거는 1인 가구 계열로 취급한다 |
| `Q1_OTHER` | 그 외예요 | 1 | |

### Q2 — 요즘 하루하루 기분은 어떤가요? (health)

| 선택지 코드 | 표시 문구 | weight |
|---|---|---|
| `Q2_HEAVY` | 대체로 가라앉아 있어요 | 2 |
| `Q2_UPDOWN` | 좋을 때도 있고 아닐 때도 있어요 | 1 |
| `Q2_FLAT` | 특별한 감정 변화가 없어요 | 1 |
| `Q2_OK` | 대체로 괜찮아요 | 0 |

### Q3 — 몸 상태나 병원은 어떤가요? (health)

| 선택지 코드 | 표시 문구 | weight |
|---|---|---|
| `Q3_EXHAUSTED` | 늘 지쳐 있고 회복이 안 돼요 | 2 |
| `Q3_NEED_CARE` | 가봐야 할 것 같은데 못 가고 있어요 | 2 |
| `Q3_SOMETIMES` | 가끔 힘들지만 넘길 수 있어요 | 1 |
| `Q3_FINE` | 특별히 불편한 건 없어요 | 0 |

### Q4 — 요즘 일이나 구직은 어떤가요? (employment)

| 선택지 코드 | 표시 문구 | weight |
|---|---|---|
| `Q4_NONE` | 일하지 않고 구직도 쉬고 있어요 | 2 |
| `Q4_SEEKING` | 구직 중이에요 | 1 |
| `Q4_PART` | 아르바이트나 단기 일을 해요 | 1 |
| `Q4_WORKING` | 일정하게 일하고 있어요 | 0 |

### Q5 — 돈 문제는 어떤가요? (employment)

| 선택지 코드 | 표시 문구 | weight |
|---|---|---|
| `Q5_DEBT` | 갚아야 할 돈이 부담돼요 | 2 |
| `Q5_TIGHT` | 생활비가 빠듯해요 | 1 |
| `Q5_UNSURE` | 생각하고 싶지 않아요 | 1 |
| `Q5_OK` | 크게 걱정은 없어요 | 0 |

### Q6 — 어떤 때가 가장 편한가요? (형용사, 축 없음)

`SPEC.md` 2절에 고정되어 있다. weight 없음.

| 선택지 코드 | 표시 문구 | 형용사 |
|---|---|---|
| `Q6_NIGHT_ALONE` | 밤에 혼자 있는 시간이 가장 편해요 | 조용한 |
| `Q6_WITH_CLOSE` | 마음 맞는 사람과 있을 때가 편해요 | 다정한 |
| `Q6_ON_PLAN` | 계획대로 하루가 굴러가면 편해요 | 부지런한 |
| `Q6_NO_RUSH` | 서두르지 않고 흐르는 대로가 편해요 | 느긋한 |

---

## 5. 판정 함수 계약 (확정)

`lib/diagnosis/classify.ts`

```ts
export type Axis = "housing" | "health" | "employment"
export type AxisScores = Record<Axis, number>

/** 클라이언트가 보내는 답변. 코드만 받는다. */
export type Answer = { questionCode: string; choiceCode: string }

export type DiagnosisResult = {
  typeCode: TypeCode
  adjective: Adjective
  axisScores: AxisScores
}

export function classify(answers: Answer[]): DiagnosisResult
```

### 축 점수

```
housing    = Q1 선택지의 weight
health     = Q2 weight + Q3 weight
employment = Q4 weight + Q5 weight
```

### 판정 규칙

```
1. Q1 === "Q1_FAMILY"                        → FAMILY_LIVING
2. health >= 2 && health >= employment        → HEALTH_EMOTION
3. 그 외                                      → INDEPENDENT_LOW_INCOME
```

규칙은 위에서부터 순서대로 평가하고 처음 걸리는 곳에서 멈춘다. 세 가지를 명시한다.

- **가족 동거는 다른 축을 보지 않고 확정한다.** health와 employment가 아무리 높아도 규칙 1이 이긴다
- **동점(`health === employment`)이면 `HEALTH_EMOTION`이다.** 건강·정서 문제는 방치했을 때 위험이 크고, 이 유형의 미션이 더 낮은 강도에서 시작하므로 잘못 판정했을 때 피해가 적은 방향이다
- **모든 답이 약한 경우(전부 0)의 기본값은 `INDEPENDENT_LOW_INCOME`이다.** 1인 가구 자체가 이 유형의 핵심 특성(92%)이다. 기본값을 정하지 않으면 판정 함수에 미정의 경로가 생겨 스냅샷 테스트를 쓸 수 없다

`employment`는 규칙 2의 비교에만 쓰인다. 단독으로 유형을 결정하는 분기를 추가하지 않는다.

### 신뢰 경계 — 중요

**서버는 `choiceCode`만 신뢰하고, `axis`와 `weight`는 서버의 문항 테이블에서 조회한다.** 클라이언트가 보낸 weight를 그대로 쓰면 사용자가 요청을 조작해 원하는 유형을 만들 수 있다.

검증 규칙:

- Q1~Q6이 **모두** 있어야 한다. 하나라도 없으면 판정하지 않는다
- 문항 테이블에 없는 `choiceCode`가 오면 판정하지 않는다
- 같은 `questionCode`가 두 번 오면 판정하지 않는다
- 판정하지 않는 경우 `classify()`는 throw하고, API는 `fail("INVALID_ANSWER", "진단 답변이 올바르지 않습니다", 400)`으로 응답한다

### DB 저장 형태

`DiagnosisSession.answers`에는 서버가 축·가중치를 채워 넣은 형태로 저장한다. Q6은 축이 없으므로 `axis: null`, `weight: 0`이다.

```json
[
  { "questionCode": "Q1", "choiceCode": "Q1_ALONE",      "axis": "housing",    "weight": 2 },
  { "questionCode": "Q2", "choiceCode": "Q2_HEAVY",      "axis": "health",     "weight": 2 },
  { "questionCode": "Q3", "choiceCode": "Q3_EXHAUSTED",  "axis": "health",     "weight": 2 },
  { "questionCode": "Q4", "choiceCode": "Q4_WORKING",    "axis": "employment", "weight": 0 },
  { "questionCode": "Q5", "choiceCode": "Q5_OK",         "axis": "employment", "weight": 0 },
  { "questionCode": "Q6", "choiceCode": "Q6_NIGHT_ALONE","axis": null,         "weight": 0 }
]
```

---

## 6. 스냅샷 시나리오 18개 (확정)

`scripts/check-diagnosis.ts`. **아래 기대값은 손으로 확정한 것이다. 구현 결과에 맞춰 기대값을 고치지 않는다.** 어긋나면 판정 함수가 틀린 것이다.

Q1은 `Q1_` 접두사를, Q2~Q6은 각 문항 접두사를 생략해 적었다. 예: `F1`의 Q1은 `Q1_FAMILY`.

| # | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | health | emp | 기대 유형 | 기대 형용사 | 검증 목적 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | FAMILY | HEAVY | EXHAUSTED | NONE | DEBT | NIGHT_ALONE | 4 | 4 | FAMILY_LIVING | QUIET | 가족 확정이 다른 축을 이긴다 |
| F2 | FAMILY | OK | FINE | WORKING | OK | ON_PLAN | 0 | 0 | FAMILY_LIVING | DILIGENT | 가족 + 신호 없음 |
| F3 | FAMILY | UPDOWN | SOMETIMES | SEEKING | TIGHT | WITH_CLOSE | 2 | 2 | FAMILY_LIVING | WARM | 가족 + 중간 신호 |
| F4 | FAMILY | FLAT | NEED_CARE | PART | UNSURE | NO_RUSH | 3 | 2 | FAMILY_LIVING | EASYGOING | 가족 + health 우세 |
| F5 | FAMILY | HEAVY | FINE | NONE | OK | NIGHT_ALONE | 2 | 2 | FAMILY_LIVING | QUIET | 가족 + 동점 |
| F6 | FAMILY | OK | EXHAUSTED | WORKING | DEBT | ON_PLAN | 2 | 2 | FAMILY_LIVING | DILIGENT | 가족 + 혼합 |
| H1 | ALONE | HEAVY | EXHAUSTED | WORKING | OK | NIGHT_ALONE | 4 | 0 | HEALTH_EMOTION | QUIET | health 단독 우세 |
| H2 | ALONE | UPDOWN | SOMETIMES | SEEKING | OK | WITH_CLOSE | 2 | 1 | HEALTH_EMOTION | WARM | 임계값 health=2 |
| H3 | SHARE | HEAVY | FINE | NONE | OK | ON_PLAN | 2 | 2 | HEALTH_EMOTION | DILIGENT | **동점은 HEALTH** |
| H4 | ALONE | FLAT | NEED_CARE | PART | TIGHT | NO_RUSH | 3 | 2 | HEALTH_EMOTION | EASYGOING | health가 1 높음 |
| H5 | OTHER | HEAVY | EXHAUSTED | NONE | DEBT | NIGHT_ALONE | 4 | 4 | HEALTH_EMOTION | QUIET | 둘 다 최대, 동점 |
| H6 | ALONE | UPDOWN | NEED_CARE | WORKING | UNSURE | WITH_CLOSE | 3 | 1 | HEALTH_EMOTION | WARM | 비가족 + health 우세 |
| I1 | ALONE | OK | FINE | NONE | DEBT | ON_PLAN | 0 | 4 | INDEPENDENT_LOW_INCOME | DILIGENT | 경제 단독 우세 |
| I2 | ALONE | UPDOWN | FINE | NONE | TIGHT | NIGHT_ALONE | 1 | 3 | INDEPENDENT_LOW_INCOME | QUIET | health가 임계값 미달 |
| I3 | SHARE | HEAVY | FINE | NONE | DEBT | NO_RUSH | 2 | 4 | INDEPENDENT_LOW_INCOME | EASYGOING | **H3과 경계쌍. emp가 더 크면 INDEPENDENT** |
| I4 | ALONE | OK | FINE | WORKING | OK | WITH_CLOSE | 0 | 0 | INDEPENDENT_LOW_INCOME | WARM | **전부 0 → 기본값** |
| I5 | OTHER | FLAT | SOMETIMES | NONE | DEBT | ON_PLAN | 2 | 4 | INDEPENDENT_LOW_INCOME | DILIGENT | 임계값 충족했지만 emp 우세 |
| I6 | ALONE | UPDOWN | SOMETIMES | SEEKING | DEBT | WITH_CLOSE | 2 | 3 | INDEPENDENT_LOW_INCOME | WARM | emp가 1 높음 |

H3과 I3은 Q1·Q2·Q3이 같고 Q5만 다르다(`Q5_OK` → `Q5_DEBT`). 동점 경계가 정확히 어디서 뒤집히는지 확인하는 쌍이므로 둘 다 남긴다.

추가로 이상 입력 4개도 함께 검증한다. 모두 throw해야 한다.

1. 문항 5개만 보낸 경우 (Q6 누락)
2. 존재하지 않는 `choiceCode` (`"Q2_UNKNOWN"`)
3. Q3이 두 번 들어온 경우
4. 빈 배열

`package.json`에 `"check:diagnosis": "tsx scripts/check-diagnosis.ts"`를 추가한다.

---

## 7. 미션 콘텐츠 스펙 (확정)

### 개수와 코드

- 단계 미션은 유형당 12개 = 3단계 × 4개. 총 36개
- `code` 규칙: `{TYPE_CODE}_S{단계}_{1~4}` — 예: `HEALTH_EMOTION_S1_1`, `FAMILY_LIVING_S3_4`
- `order`는 단계 안에서 1~4
- `typeCode`와 `stage`를 반드시 채운다 (`scope: "STAGE"`)

### 보상 (고정값)

| 단계 | `rewardSeeds` | `rewardShards` | `requiresPhoto` |
|---|---|---|---|
| 1단계 | 20 | 0 | false |
| 2단계 | 35 | 0 | false |
| 3단계 | 60 | 5 | 4개 중 2개만 true |

`rewardAffinity`는 단계 미션에 넣지 않는다. 친밀도는 챗봇·커뮤니티(D)와 일일 미션에서만 나온다.

3단계 4개 중 사진 미션 2개는 `order` 3, 4에 배치한다. 사진 미션은 3단계에만 둔다.

### 단계 설계

- 1단계: 집 안에서, 침대에서 손만 움직여도 되는 수준
- 2단계: 집 주변으로 나가는 것 (현관 밖, 편의점, 동네 한 바퀴)
- 3단계: 사람과 접촉하는 것 (인사, 짧은 대화, 사진으로 남기기)

### 문구 기준

타겟 특성상 문구 톤이 기능만큼 중요하다.

- 명령·강요 표현을 쓰지 않는다. "~하세요"보다 "~해봐요", "~해도 좋아요"
- 실패해도 부담이 없게 쓴다. "1분만", "한 번만", "안 되면 내일 해도 괜찮아요"
- `title`은 12자 이내, `description`은 한 문장
- 근거는 연구보고서 PDF의 유형별 특성을 따른다. 유형별로 결이 달라야 한다
  - `INDEPENDENT_LOW_INCOME` (여우): 혼자 사는 생활 관리, 지출·일 관련 부담이 낮은 것
  - `HEALTH_EMOTION` (고양이): 몸과 기분 회복이 먼저. 강도를 가장 낮게
  - `FAMILY_LIVING` (곰): 가족과의 접촉이 자연스러운 소재. 집 안에서 사람과 마주치는 것부터

---

## 8. 화면·API 계약 (확정)

### 화면

`app/diagnosis/page.tsx` **한 장**으로 만든다. 문항별 라우트를 만들지 않는다.

- 진행 상태(현재 문항 번호, 지금까지의 답변)는 클라이언트 컴포넌트 state에 둔다
- 진행률 바는 `현재 문항 / 6`
- 6번 문항에 답하면 그때 한 번만 완료 API를 호출한다. 문항마다 서버를 부르지 않는다
- 결과는 `app/diagnosis/result/page.tsx`

### `POST /api/diagnosis/complete`

```ts
// 요청
{ answers: [{ questionCode: "Q1", choiceCode: "Q1_ALONE" }, ...6개] }

// 성공
{ data: { typeCode, adjective, nickname, family, animal, colorHex } }
```

처리 순서:

1. `const user = await getCurrentUser()`
2. `classify(answers)` — 실패 시 `fail("INVALID_ANSWER", "진단 답변이 올바르지 않습니다", 400)`
3. `defaultNickname(typeCode, adjective)`로 닉네임 생성
4. `User` 갱신 — `typeCode`, `adjective`, `nickname`, `activePetSkinId`. **레벨·경험치·재화·아이템·streak은 건드리지 않는다** (재진단에서 같은 코드가 돌기 때문이다)
5. 기본 펫 지정 — `prisma.petSkin.findFirst({ where: { typeCode, isDefault: true } })`의 id를 `activePetSkinId`에 넣고, `UserPetSkin`을 `upsert`로 보유 처리한다 (`@@unique([userId, petSkinId])`)
6. `DiagnosisSession` 생성 — 5장의 JSON 형태로 `answers` 저장
7. 4·5·6을 하나의 `prisma.$transaction`으로 묶는다. 중간에 실패하면 유형만 바뀌고 펫이 안 바뀌는 상태가 남는다

**재진단은 이 엔드포인트를 그대로 다시 호출한다.** 별도 API를 만들지 않는다. `DiagnosisSession`은 매번 새 행이 쌓이므로 이력이 남고, `Post.galleryType`은 글마다 저장돼 있어 과거 글은 이동하지 않는다.

### `PATCH /api/diagnosis/nickname`

```ts
// 요청
{ nickname: "밤바다" }

// 성공
{ data: { nickname } }
```

`isValidNickname()`으로 검증한다(2~12자, `lib/types.ts`). 실패 시 `fail("INVALID_NICKNAME", "닉네임은 2~12자로 입력해 주세요", 400)`. 유니크 검사는 하지 않는다.

---

## 9. 다음 할 일
1. `prisma/seed/missions.ts`에 단계 미션 36개 작성 (7장)
2. `lib/diagnosis/questions.ts` (4장)
3. `lib/diagnosis/classify.ts` (5장)
4. `scripts/check-diagnosis.ts` (6장) + `package.json`에 `check:diagnosis` 추가
