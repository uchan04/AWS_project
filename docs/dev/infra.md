# 인프라·인증 개발 문서 (담당 E)

세션이 초기화되면 이 문서를 먼저 읽는다. 작업을 끝낼 때마다 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 10절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: Next.js 프로젝트, Prisma 6 + 스키마, `lib/auth.ts` 스텁, `lib/prisma.ts`, `lib/api.ts`, `.env.example`
- 진행 중: 없음
- 미착수: Amplify, RDS, Cognito, Bedrock 확인, S3 + CloudFront, CloudWatch + SNS, 로그인 화면, 희망 문구 배너, 발표 자료

## 구현한 파일
- `lib/auth.ts` — `getCurrentUser()`. 현재 `DEV_AUTH_BYPASS=true`면 고정 유저를 upsert해 반환하는 스텁
- `lib/prisma.ts` — PrismaClient 싱글턴 (hot reload 커넥션 고갈 방지)
- `lib/api.ts` — `ok()` / `fail()` 응답 헬퍼
- `prisma/seed.ts` — 시드 엔트리

## 결정한 것과 이유
- **Prisma는 6.x로 고정한다.** 7은 `prisma.config.ts` + driver adapter가 필수여서 설정 실패 지점이 늘고 참고 자료도 적다
- `DEV_AUTH_BYPASS`는 배포 환경에서 절대 true로 두지 않는다

## 막힌 것
- RDS 미생성. `DATABASE_URL`이 비어 있어 `prisma migrate dev`를 아직 실행하지 못했다

## 다음 할 일
1. RDS Postgres `db.t4g.micro` 생성 (퍼블릭 액세스 차단, 자동 백업 7일) → `DATABASE_URL` 채우고 `npx prisma migrate dev --name init` → 마이그레이션 커밋
2. GitHub 레포 연결 + Amplify Hosting 배포. Amplify 환경변수에 `.env.example`의 키 전부 등록
3. Cognito 사용자 풀 (이메일+비밀번호, 인증 코드 비활성) → `lib/auth.ts`의 TODO를 `aws-jwt-verify`로 구현
