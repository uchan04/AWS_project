# 미션 시스템 개발 문서 (담당 B)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 4절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 미션 조회 API, 일반·이벤트 완료, 출석, S3 업로드, Bedrock 사진 판정, 단계 해금, streak, UI 연결
- 완료: **단계 3개 → 100개 확장 (2026-08-22, A).** 아래 "100단계 커리큘럼" 절. `SPEC.md` 4절도 같이 다시 썼다
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
- **옛 시드가 만든 단계당 4번째 미션 9개가 실 DB에 남아 있다.** 지우지 않고 **코드에서 배제한다**(공유 DB는 손대지 않기로 했다). 조회 4곳(`dashboard.ts:105`·`:112`, `stages.ts:92`·`:99`)이 `order <= MISSIONS_PER_STAGE`로 거르고, 완료 경로도 2026-08-22에 같은 조건을 갖췄다(아래). `scripts/prune-orphan-stage-missions.ts`는 남겨 두지만 실행하지 않는다

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
- `app/missions/MissionDashboard.tsx` — 기존 Figma JSX 보존, API 연결, ProgressCard, AttendanceCalendar
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
