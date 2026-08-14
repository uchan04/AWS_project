# 고립은둔청년 맞춤형 사회 복귀 AI 서비스

부트캠프 프로젝트. Next.js + Prisma + AWS.

## 문서

| 문서 | 내용 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | **작업 규칙. 개발 시작 전에 반드시 읽는다** |
| [SPEC.md](SPEC.md) | 기능·데이터 모델 확정 명세 |
| [업무분담.md](업무분담.md) | 담당 범위, 일정, 컷 순서 |
| `docs/dev/*.md` | 기능별 개발 진행 상황. 세션 시작 시 자기 담당 문서를 먼저 읽는다 |

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

`npx prisma migrate dev`는 스키마 담당 1인만 실행한다. `migrate reset`은 절대 실행하지 않는다.
