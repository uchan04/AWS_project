# 작업 규칙

고립은둔청년 맞춤형 사회 복귀 AI 서비스. 부트캠프 프로젝트, 5인 병렬 개발, 개발 마감 2026-08-22.

**세션 시작 절차 — 이 순서로만 읽는다**

1. `docs/STATUS.md` — 전체 진행 상황. 여기 "지금 읽어야 할 문서" 표가 이번 세션에 읽을 문서를 지정한다
2. 그 표에 적힌 자기 담당 `docs/dev/<기능>.md`
3. 그 표에 적힌 `SPEC.md` 해당 절만. 전체를 읽지 않는다

문서를 전부 읽으면 맥락이 컨텍스트를 다 먹고 정작 코드를 읽을 여유가 없어진다. 표에 없는 문서는 그 내용이 실제로 필요해질 때 그때 읽는다.

| 문서 | 언제 읽는가 |
|---|---|
| `docs/STATUS.md` | 매 세션 시작 시. 필수 |
| `docs/dev/<기능>.md` | 매 세션 시작 시, 자기 담당분만 |
| `SPEC.md` | 필요한 절만. `## <번호>.` 헤딩으로 찾아 그 절만 읽는다 |
| `prisma/schema.prisma` | DB를 읽거나 쓰는 코드를 만질 때 |
| `업무분담.md` | 일정·컷 순서·담당 경계를 확인할 때만 |
| `아이디어.md`, 연구보고서 PDF | 미션 콘텐츠·문구를 새로 쓸 때만 (A) |

`SPEC.md` 절 색인: 1 제약 / 2 유형·종족 / 3 진단 / 4 미션 / 5 키우기 / 6 공유 함수 / 7 챗봇 / 8 커뮤니티 / 9 배너 / 10 아키텍처·AWS / 11 데이터 모델 / 12 제외 기능 / 13 심사 질문

`SPEC.md`에 없는 기능은 만들지 않는다.

기술 스택: Next.js (App Router, TypeScript) / Prisma + RDS Postgres / Cognito / Bedrock Claude Sonnet (us-east-1) / S3 / AWS Amplify Hosting.

---

## 1. 공유 파일 — 브랜치에서 고치지 않는다

아래 파일은 5인이 전부 의존한다. **기능 브랜치에서 수정하면 머지 시점에 충돌이 터진다.** 변경이 필요하면 담당자에게 요청하고, 담당자가 `main`에 직접 커밋한 뒤 전원에게 알린다.

| 파일 | 소유자 | 역할 |
|---|---|---|
| `prisma/schema.prisma` | 전원 합의 | DB 스키마. 변경 시 `SPEC.md` 11절도 함께 갱신 |
| `lib/auth.ts` | E | `getCurrentUser()` — 모든 API의 첫 줄 |
| `lib/reward.ts` | C | `calculateReward()` — 재화 증감의 유일한 경로 |
| `lib/types.ts` | A | TypeCode, Adjective, 표시명 매핑 상수 |
| `app/layout.tsx` | E | 전역 레이아웃, 하단 탭 내비게이션 |
| `app/globals.css` | E | 전역 스타일·색 토큰 |
| `.env.example` | E | 환경변수 키 목록 |

Claude는 이 파일들을 **요청받지 않은 상태로 수정하지 않는다.** 수정이 필요해 보이면 먼저 사용자에게 알린다.

## 2. 절대 규칙

**재화 증감은 `calculateReward()`만 통과한다.**

```ts
// 금지
user.seeds += 10

// 필수
const reward = calculateReward(user.activePetSkin, { seeds: 10 })
```

캐릭터 고유 효과(씨앗 +15% 등)가 이 함수 안에만 있다. 직접 증감하면 배율이 빠지거나 이중 적용된다.

**남의 폴더를 건드리지 않는다.** `app/diagnosis/` A, `app/missions/` B, `app/pet/` C, `app/community/` D, `app/(auth)/` E. 다른 사람 폴더의 버그를 발견하면 고치지 말고 알린다.

**새 라이브러리를 추가하지 않는다.** `package.json`에 이미 있는 것으로 해결한다. 정말 필요하면 사용자에게 이유를 먼저 설명하고 승인을 받는다. 비개발자 5인 프로젝트에서 의존성 추가는 빌드 실패와 Amplify 배포 실패의 가장 흔한 원인이다.

**요청받지 않은 리팩터링을 하지 않는다.** 돌아가는 코드를 정리하다가 깨는 것이 가장 흔한 사고다. 명세에 있는 기능만, 요청받은 범위만 구현한다.

**API는 첫 줄에서 인증한다.**

```ts
const user = await getCurrentUser() // 미인증이면 throw
```

## 3. 커밋

기능 단위로 커밋한다. "오늘 작업분"을 한 번에 커밋하지 않는다. 세션이 초기화되거나 코드가 깨졌을 때 되돌릴 지점이 필요하다.

형식은 `<type>: <한국어 설명>`. type은 `feat` `fix` `refactor` `docs` `chore` 중 하나.

```
feat: 일일 미션 목록 화면
fix: 미션 중복 완료 시 500 에러
docs: 미션 개발 문서 갱신
```

하나의 커밋에 두 가지 기능을 섞지 않는다. 커밋 전에 `npm run build`가 통과하는지 확인한다. 빌드가 깨진 커밋이 `main`에 들어가면 Amplify 배포가 실패하고 전원이 막힌다.

## 4. 브랜치

브랜치는 담당별로 고정한다.

| 담당 | 브랜치 |
|---|---|
| A | `feat/diagnosis` |
| B | `feat/missions` |
| C | `feat/pet` |
| D | `feat/community` |
| E | `feat/infra` |

리뷰 없이 본인이 직접 `main`에 머지한다(셀프 머지).

**하루에 최소 1회 `main`으로 머지한다.** 이틀 이상 머지하지 않은 브랜치는 만들지 않는다. 오래 묵은 브랜치는 머지 시점에 대형 충돌로 돌아오고, 이 팀에서 대형 충돌 해결은 기능 하나를 새로 만드는 것보다 오래 걸린다.

머지 절차:

```bash
git checkout main && git pull
git checkout feat/pet && git merge main
```

여기서 충돌을 해결하고 빌드를 확인한 뒤,

```bash
git checkout main && git merge feat/pet && git push
```

`rebase`는 쓰지 않는다. 충돌이 커밋마다 반복돼 되돌리기 어렵다.

## 5. 마이그레이션

`npx prisma migrate dev`는 **스키마 담당 1인만** 실행한다. 여러 명이 각자 실행하면 마이그레이션 히스토리가 갈라져 병합이 불가능해진다.

나머지 4인은 스키마가 바뀌었다는 공지를 받으면 이것만 실행한다.

```bash
git pull && npx prisma migrate deploy && npx prisma generate
```

`migrate reset`은 절대 실행하지 않는다. 공유 DB의 모든 데이터가 삭제된다. 로컬에서 초기화가 필요하면 먼저 팀에 알린다.

## 6. 개발 문서 — 세션 초기화 대비

Claude 세션은 길어지면 초기화된다. 초기화 후 맥락을 복구할 수 있도록 **작업 종료 시마다** 두 문서를 갱신한다.

| 문서 | 범위 | 갱신 시점 |
|---|---|---|
| `docs/STATUS.md` | 프로젝트 전체 한 장. 단계, 담당별 상태, 차단 사항, 이번 단계에 읽을 문서 | 작업 종료 시, `main` 머지 시 |
| `docs/dev/<기능>.md` | 자기 기능의 세부. 구현한 파일, 결정 이유, 막힌 것 | 작업 종료 시 |

`docs/STATUS.md`에는 한 줄 요약만 쓴다. 세부를 여기에 쓰면 문서가 길어져 "매 세션 읽는 문서"의 값이 떨어진다.

기능 문서 경로: `docs/dev/<기능>.md` (`diagnosis` `missions` `pet` `community` `infra`)

형식:

```markdown
# 미션 시스템 개발 문서

## 현재 상태
- 완료: 일일 미션 목록 화면, 완료 처리 API
- 진행 중: 단계 미션 잠금·해제
- 미착수: 사진 업로드, 출석 캘린더

## 구현한 파일
- `app/missions/page.tsx` — 일일·단계 미션 목록
- `app/api/missions/complete/route.ts` — 완료 처리. 중복은 UserMission 유니크 제약으로 차단

## 결정한 것과 이유
- 초기화는 스케줄러 없이 `lastMissionResetAt` 비교로 처리
- 단계 해제 조건은 앞 단계 4개 중 3개 완료

## 막힌 것
- 사진 미션은 E의 S3 버킷 설정 대기 중

## 다음 할 일
- 출석 캘린더 7일 그리드
```

새 세션은 `docs/STATUS.md` → 자기 기능 문서 순으로 읽고 작업을 이어간다. 문서 갱신은 `docs:` 커밋으로 남긴다.

## 7. API 응답 형식

성공과 실패 형태를 통일한다. 5인이 각자 다른 형태로 만들면 화면마다 에러 처리를 다시 쓴다.

```ts
// 성공
{ data: { ... } }

// 실패
{ error: { code: "MISSION_ALREADY_DONE", message: "이미 완료한 미션입니다" } }
```

HTTP 상태 코드는 `200` `400` `401` `404` `500`만 쓴다. `message`는 화면에 그대로 띄울 한국어 문장으로 쓴다.

## 8. 하지 않는 것

- 테스트 프레임워크 도입 (진단 판정 스냅샷 테스트만 예외. `SPEC.md` 3절)
- Docker, EC2, Lambda, EventBridge 관련 설정 일체
- 랭킹·경쟁 지표 (의도적 배제. `SPEC.md` 5절)
- 소셜 로그인, 이메일 인증 코드
- 사진 미션의 이미지 내용 판정
- 명세에 없는 화면·기능 추가

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
