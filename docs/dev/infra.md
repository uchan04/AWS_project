# 인프라·인증 개발 문서 (담당 E)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 10절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: Next.js 프로젝트, Prisma 6 + 스키마, `lib/auth.ts`(실 Cognito 검증, 쿠키 기반), `lib/prisma.ts`, `lib/api.ts`, `.env.example`, RDS, Cognito, S3+CloudFront, CloudWatch+SNS, Bedrock 확인, Amplify 앱 생성(환경변수 포함), 로그인·가입 화면(이메일+비밀번호), `amplify.yml`(2026-08-20). 내비게이션은 B의 사이드바로 교체됨(하단 탭은 폐기, 아래 "삭제한 파일" 참고)
- 2026-08-23 완료: **Google 로그인 Cognito 측 설정 전부 끝.** Google IdP 생성됨(scopes `profile email openid`, mapping `email→email` `username→sub`), App Client `welli-web-client`에 OAuth 활성화(`AllowedOAuthFlowsUserPoolClient=true`, flow `code`, scopes `openid email profile`, IdP `Google`+`COGNITO`), 콜백·로그아웃 URL 등록. `/oauth2/authorize`가 Google로 302하는 것까지 확인
- 진행 중: Amplify GitHub 연동은 완료(아래 앱 ID 참고). 남은 것은 Google Cloud Console 쪽 승인된 리디렉션 URI 확인뿐
- 미착수: 발표 자료
- 2026-08-22 A가 넘긴 것: 희망 문구 배너 구현(`app/community/_lib/banner.ts`), `middleware.ts` 미인증 리다이렉트, `lib/ratelimit.ts` 로그인·가입 시도 제한, `/settings`(비밀번호 변경·회원 탈퇴). 아래 "다음 할 일" 3·4번이 이걸로 해소됐다

## 구현한 파일
- `lib/auth.ts` — `getCurrentUser()`. `DEV_AUTH_BYPASS=true`면 고정 유저 upsert 스텁, 아니면 `access_token` httpOnly 쿠키를 `aws-jwt-verify`로 검증 후 `sub`으로 upsert. `Authorization` 헤더는 안 읽는다 — 문서 내비게이션(링크 클릭·주소창 이동)에는 커스텀 헤더가 안 붙어서 서버 컴포넌트 페이지를 인증할 수 없었다(`docs/STATUS.md` "외부 피드백 검증" 참고)
- `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/api.ts` — 이메일+비밀번호 폼 + Google 보조 버튼
- `app/api/auth/{signup,login}/route.ts` — Cognito Admin API 직접 호출. 인증 메일 없이 즉시 확정 계정 생성(`AdminCreateUser` + `AdminSetUserPasswordCommand`)
- `app/api/auth/{google,callback}/route.ts` — Cognito Hosted UI(Google IdP) OAuth code 플로우
- `app/api/auth/logout/route.ts` — 쿠키 삭제
- `amplify.yml` — Next.js SSR 빌드 스펙 명시 (Next 16 자동 감지에 의존하지 않음)
- `lib/prisma.ts` — PrismaClient 싱글턴 (hot reload 커넥션 고갈 방지)
- `lib/api.ts` — `ok()` / `fail()` 응답 헬퍼
- `prisma/seed.ts` — 시드 엔트리
- `app/globals.css` — 종족 컬러 토큰 3종(`--color-canine` `--color-feline` `--color-ursine`) 추가

## 삭제한 파일
- `app/components/BottomNav.tsx` — **2026-08-20 삭제.** B가 내비게이션을 사이드바(`app/components/Sidebar.tsx`)로 교체하며 `app/layout.tsx`에서 뺐고(`65308c4`), 이후 아무도 import하지 않는 고아 파일이었다(레포 전체 검색으로 확인). `docs/STATUS.md` 차단 13번 참고

## 결정한 것과 이유
- **Prisma는 6.x로 고정한다.** 7은 `prisma.config.ts` + driver adapter가 필수여서 설정 실패 지점이 늘고 참고 자료도 적다
- `DEV_AUTH_BYPASS`는 배포 환경에서 절대 true로 두지 않는다
- **RDS는 Publicly Accessible=true, SG는 5432를 0.0.0.0/0에 개방했다.** 스펙 초안의 "퍼블릭 액세스 차단"과 충돌했다 — 팀원 5명이 로컬 PC에서 직접 `DATABASE_URL`로 접속해 개발해야 하는데 비공개로 두면 물리적으로 접속이 불가능하다. EC2/bastion/VPN은 이미 배제한 선택지였다. 강력한 마스터 비밀번호로만 방어한다. **발표 전 반드시 팀에서 재검토할 것** — 데모 종료 후에는 잠가야 한다
- Cognito 인증 코드 비활성(스펙대로), 비밀번호 정책은 최소 8자만 강제(팀원 마찰 최소화)
- **로그인은 이메일+비밀번호와 Google을 함께 지원한다**(결정 변경, `docs/STATUS.md` 참고). `SPEC.md` 10절·`CLAUDE.md` 8절의 소셜 로그인 금지 조항은 이번에 풀었다
- 세션은 `Authorization` 헤더가 아니라 `access_token` httpOnly 쿠키로 전달한다. App Client(`welli-web-client`)는 시크릿 없는 public client라 토큰 교환에 별도 인증 헤더가 필요 없다
- Amplify 환경변수에 `DATABASE_URL`(마스터 비밀번호 포함)을 평문으로 등록했다. Secrets Manager는 팀이 이미 배제한 선택지라 `.env.example`에 정한 방식(Amplify 환경변수가 유일한 비밀값 저장소)을 그대로 따른다
- Amplify 환경변수에는 `AWS_` 프리픽스를 쓸 수 없다(예약어). `AWS_REGION`은 Lambda 런타임이 자동 주입하므로 별도 등록 불필요

## 막힌 것
- **Amplify ↔ GitHub 연동은 CLI로 끝까지 할 수 없다.** GitHub App 설치는 브라우저 OAuth 동의가 필요해 계정 소유자가 직접 눌러야 한다. 아래 "Amplify GitHub 연동" 절차대로 진행하면 5분 내 끝난다
- ~~**Google 로그인도 사용자가 직접 해야 하는 단계가 남았다.**~~ **2026-08-23 해결.** Google Cloud OAuth 클라이언트 발급 완료, `create-identity-provider` + `update-user-pool-client` 실행 완료. Google Cloud Console 쪽 승인된 리디렉션 URI가 `https://welli-auth-185236887369.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`와 정확히 일치해야 한다(스킴·경로 문자열 완전 일치). OAuth 동의 화면이 "테스트" 상태면 테스트 사용자로 등록된 Google 계정만 로그인된다 — 발표 전 확인할 것

## 다음 할 일
1. **(사용자 직접) Amplify GitHub 연동** — 아래 절차 참고. 끝나면 `main` push 시 자동 배포된다
2. **(사용자 직접) Google Cloud OAuth 클라이언트 발급** — 위 "막힌 것" 참고
3. ~~서버 컴포넌트 페이지의 미인증 리다이렉트 규칙 확정~~ → 2026-08-22 A가 `middleware.ts`로 정했다. 쿠키가 없으면 `/login?next=<원래 경로>`로 보낸다. 쿠키 존재만 보는 UX 게이트이고 보안 경계가 아니다(Edge 런타임에서 `lib/session.ts`의 Node crypto 검증을 못 돈다) — 실제 인증은 라우트·페이지 첫 줄의 `getCurrentUser()`가 그대로 한다
4. ~~희망 문구 배너~~ → 해소 (`app/community/_lib/banner.ts`)
5. 8/20부터 발표 자료 착수

## Amplify 배포 (연동 완료)

**앱 이름은 `mokoji`, appId `d2ynoyp44lt46h`, 리전 us-east-1.** 문서에 오래 적혀 있던 `d36bhb2dnkr0oj`는 존재하지 않는 앱이다(2026-08-23 정정). GitHub 연동은 끝났고 `main` push 시 자동 배포된다.

- 콘솔: https://us-east-1.console.aws.amazon.com/amplify/apps/d2ynoyp44lt46h
- 라이브 URL: `https://main.d2ynoyp44lt46h.amplifyapp.com` (커스텀 도메인 없음)
- 빌드 설정은 레포 루트의 `amplify.yml`을 쓴다(2026-08-20부터 자동 감지 대신 명시적 스펙)
- 앱 레벨 환경변수 11개 등록됨. `DEV_AUTH_BYPASS=false` 확인됨(2026-08-23)
- **`BEDROCK_VISION_MODEL_ID`가 콘솔에 등록되어 있지 않다** — 사진 미션에서 터질 자리. C·B 담당분 확인 필요

### 환경변수를 추가할 때 반드시 두 곳을 고친다

Amplify 콘솔 환경변수는 빌드 컨테이너에만 주입되고 SSR 컴퓨트(Lambda)에는 전달되지 않는다. 그래서 `amplify.yml`의 `env | grep -e ...` 목록에 키를 **직접 추가**해야 런타임에 실린다. 콘솔에만 등록하면 런타임에서 `undefined`다. `COGNITO_REDIRECT_URI`가 콘솔에는 있는데 grep 목록에 없어서 코드에서 쓸 수 없던 상태였다(2026-08-23 수정).

## GitHub 레포·브랜치

레포 연결과 브랜치 5개(`feat/diagnosis` `feat/missions` `feat/pet` `feat/community` `feat/infra`) 생성이 끝났다. `DATABASE_URL` 등 실제 값이 든 `.env`는 커밋하지 않으므로, 팀원에게는 E가 개별적으로 값을 공유한다.
