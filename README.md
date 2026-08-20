# 고립은둔청년 맞춤형 사회 복귀 AI 서비스

부트캠프 프로젝트. Next.js + Prisma + AWS.

## 문서

**[docs/STATUS.md](docs/STATUS.md)부터 읽는다.** 지금 단계에서 읽어야 할 문서만 지정해 준다.

| 문서 | 내용 |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | **진행 상황. 매 세션 여기서 시작한다** |
| [docs/인수인계.md](docs/인수인계.md) | 팀원 인수인계 한 장. 진척도·애로사항·담당별 첫 작업 |
| [CLAUDE.md](CLAUDE.md) | 작업 규칙. 커밋·브랜치·공유 파일·문서 갱신 |
| [SPEC.md](SPEC.md) | 기능·데이터 모델 확정 명세. 필요한 절만 읽는다 |
| [업무분담.md](업무분담.md) | 담당 범위, 일정, 컷 순서 |
| `docs/dev/*.md` | 기능별 개발 진행 상황. 자기 담당분만 읽는다 |

## 처음 받았을 때

```bash
npm install
cp .env.example .env
```

`.env`의 `DATABASE_URL`을 채운 뒤,

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

RDS가 아직 없으면 `DATABASE_URL`을 로컬 Postgres로 가리켜도 된다.

## 스크립트

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 빌드. **커밋 전에 통과하는지 확인한다** |
| `npm run db:seed` | 미션·아이템 시드 |
| `npm run check:reward` | `calculateReward()` 자체 체크. reward 로직을 고쳤으면 돌린다 |
| `npm run check:diagnosis` | 유형 판정 스냅샷 체크. 시나리오 20개 + 경계쌍 3 + 조기 종료 무손실 검증. 지표 매핑이나 판정 규칙을 고쳤으면 돌린다 |

`npx prisma migrate dev`는 스키마 담당 1인만 실행한다. `migrate reset`은 절대 실행하지 않는다.
