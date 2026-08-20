# 미션 시스템 개발 문서 (담당 B)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 4절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 미션 조회 API, 일반·이벤트 완료, 출석, S3 업로드, Bedrock 사진 판정, 단계 해금, streak, UI 연결
- 진행 중: 없음
- 미착수: 일일 전체 완료 별조각 보너스, 7일 streak 별조각 보너스, 실제 S3·Bedrock 환경 검증

## 구현한 파일

### 도메인 로직
- `lib/missions/reset.ts` — 날짜 helper, 접속 시점 초기화
- `lib/missions/stages.ts` — 단계 해금 계산
- `lib/missions/dashboard.ts` — 전체 DTO 조립
- `lib/missions/completion.ts` — 공통 완료 함수, completeMissionByCode()
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
- 단계 해제는 이전 단계 4개 중 3개 완료
- 출석 `dayIndex = (attendanceTotal - 1) % 7 + 1`
- DAILY_COMMUNITY_POST, DAILY_CHAT는 `completeMissionByCode()`로만 완료 (D 담당 연결 필요)
- S3 key는 서버가 생성 (`missions/{userId}/{missionId}/{randomId}.{ext}`)
- 사진 판정은 S3 이미지 + `Mission.description` → Bedrock Converse → Nova 멀티모달 → Tool Use `{passed, reason}`
- Tool schema 최상위에는 `type`, `properties`, `required`만 사용 (`additionalProperties` 제외)
- `toolChoice`로 `verify_mission` 강제, `temperature: 0`, `topK: 1`

## 막힌 것
- 실제 S3 환경변수와 Bedrock 권한 미검증 — `.env`의 `S3_BUCKET`, `BEDROCK_VISION_MODEL_ID` 값 필요
- 출석 보상표 임시 값 (팀 합의 필요)
- 일일 전체 완료·7일 streak 별조각 보너스 수치 미확정
- D 담당의 `completeMissionByCode()` 연결 대기

## 다음 할 일
- E와 S3·Bedrock 환경 구성 확인
- 실제 RDS·S3·Bedrock 통합 테스트
- A의 이벤트 미션 친밀도 0 반영 확인
- D에게 `completeMissionByCode()` 사용 방법 전달
- 출석·보너스 보상 값 팀 합의 후 반영
