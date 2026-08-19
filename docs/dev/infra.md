# 인프라·인증 개발 문서 (담당 E)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 10절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: Next.js 프로젝트, Prisma 6 + 스키마, `lib/auth.ts`(실 Cognito 검증), `lib/prisma.ts`, `lib/api.ts`, `.env.example`, RDS, Cognito, S3+CloudFront, CloudWatch+SNS, Bedrock 확인, 하단 탭 내비게이션, Amplify 앱 생성(환경변수 포함)
- 진행 중: Amplify GitHub 연동 (브라우저 OAuth 필요 — 아래 참고)
- 미착수: 로그인 화면, 희망 문구 배너, 발표 자료

## 구현한 파일
- `lib/auth.ts` — `getCurrentUser()`. `DEV_AUTH_BYPASS=true`면 고정 유저 upsert 스텁, 아니면 `Authorization: Bearer <token>` 헤더를 `aws-jwt-verify`로 검증 후 `sub`으로 upsert
- `lib/prisma.ts` — PrismaClient 싱글턴 (hot reload 커넥션 고갈 방지)
- `lib/api.ts` — `ok()` / `fail()` 응답 헬퍼
- `prisma/seed.ts` — 시드 엔트리
- `app/components/BottomNav.tsx` + `app/layout.tsx` — 하단 탭 5개(진단결과/미션/펫/커뮤니티/챗봇). **동결**, 다른 담당자는 이 파일들을 고치지 않는다
- `app/globals.css` — 종족 컬러 토큰 3종(`--color-canine` `--color-feline` `--color-ursine`) 추가

## 결정한 것과 이유
- **Prisma는 6.x로 고정한다.** 7은 `prisma.config.ts` + driver adapter가 필수여서 설정 실패 지점이 늘고 참고 자료도 적다
- `DEV_AUTH_BYPASS`는 배포 환경에서 절대 true로 두지 않는다
- **RDS는 Publicly Accessible=true, SG는 5432를 0.0.0.0/0에 개방했다.** 스펙 초안의 "퍼블릭 액세스 차단"과 충돌했다 — 팀원 5명이 로컬 PC에서 직접 `DATABASE_URL`로 접속해 개발해야 하는데 비공개로 두면 물리적으로 접속이 불가능하다. EC2/bastion/VPN은 이미 배제한 선택지였다. 강력한 마스터 비밀번호로만 방어한다. **발표 전 반드시 팀에서 재검토할 것** — 데모 종료 후에는 잠가야 한다
- Cognito 인증 코드 비활성(스펙대로), 비밀번호 정책은 최소 8자만 강제(팀원 마찰 최소화)
- Amplify 환경변수에 `DATABASE_URL`(마스터 비밀번호 포함)을 평문으로 등록했다. Secrets Manager는 팀이 이미 배제한 선택지라 `.env.example`에 정한 방식(Amplify 환경변수가 유일한 비밀값 저장소)을 그대로 따른다
- Amplify 환경변수에는 `AWS_` 프리픽스를 쓸 수 없다(예약어). `AWS_REGION`은 Lambda 런타임이 자동 주입하므로 별도 등록 불필요

## 막힌 것
- **Amplify ↔ GitHub 연동은 CLI로 끝까지 할 수 없다.** GitHub App 설치는 브라우저 OAuth 동의가 필요해 계정 소유자가 직접 눌러야 한다. 아래 "Amplify GitHub 연동" 절차대로 진행하면 5분 내 끝난다

## 다음 할 일
1. **(사용자 직접) Amplify GitHub 연동** — 아래 절차 참고. 끝나면 `main` push 시 자동 배포된다
2. Cognito 회원가입 실패 시 미인증 사용자 리다이렉트 규칙 확정: API는 401 + `{ error: { code: "UNAUTHORIZED" } }`, 화면은 `/login`으로 리다이렉트 (E가 로그인 화면 만들 때 함께 정리)
3. 로그인·회원가입·로그아웃 화면 (`app/(auth)/`)
4. 희망 문구 배너 (상수 3~5개)
5. 8/20부터 발표 자료 착수

## Amplify GitHub 연동 (사용자가 직접 해야 하는 단계)

CLI로 앱(`welli`, appId `d36bhb2dnkr0oj`)과 환경변수까지는 이미 만들어 놓았다. GitHub 저장소 연결만 남았다.

1. [AWS Amplify 콘솔](https://us-east-1.console.aws.amazon.com/amplify/apps/d36bhb2dnkr0oj)에서 `welli` 앱을 연다
2. "Hosting" → "Connect branch" (또는 "Deploy without Git provider"가 아니라 GitHub 선택)
3. GitHub로 로그인 → "AWS Amplify" GitHub App 설치를 승인 → 저장소 `uchan04/AWS_project`, 브랜치 `main` 선택
4. 빌드 설정은 Next.js 자동 감지 기본값 그대로 저장
5. 첫 배포가 끝나면 `https://main.d36bhb2dnkr0oj.amplifyapp.com` (또는 표시되는 도메인)이 라이브 URL이다

## GitHub 레포·브랜치

레포 연결과 브랜치 5개(`feat/diagnosis` `feat/missions` `feat/pet` `feat/community` `feat/infra`) 생성이 끝났다. `DATABASE_URL` 등 실제 값이 든 `.env`는 커밋하지 않으므로, 팀원에게는 E가 개별적으로 값을 공유한다.
