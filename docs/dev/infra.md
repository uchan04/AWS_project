# 인프라·인증 개발 문서 (담당 E)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 10절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: Next.js 프로젝트, Prisma 6 + 스키마, `lib/auth.ts`(실 Cognito 검증, 쿠키 기반), `lib/prisma.ts`, `lib/api.ts`, `.env.example`, RDS, Cognito, S3+CloudFront, CloudWatch+SNS, Bedrock 확인, Amplify 앱 생성(환경변수 포함), 로그인·가입 화면(이메일+비밀번호), `amplify.yml`(2026-08-20). 내비게이션은 B의 사이드바로 교체됨(하단 탭은 폐기, 아래 "삭제한 파일" 참고)
- 2026-08-23 완료: **Google 로그인 Cognito 측 설정 전부 끝.** Google IdP 생성됨(scopes `profile email openid`, mapping `email→email` `username→sub`), App Client `welli-web-client`에 OAuth 활성화(`AllowedOAuthFlowsUserPoolClient=true`, flow `code`, scopes `openid email profile`, IdP `Google`+`COGNITO`), 콜백·로그아웃 URL 등록. `/oauth2/authorize`가 Google로 302하는 것까지 확인
- 2026-08-24 완료: **배포 환경에서 리다이렉트가 `localhost:3000`으로 튀던 문제 수정**(`fd8c21f`). 아래 "배포 환경에서 절대 URL을 만들지 않는다" 절 참고. Google IdP는 AWS CLI로 실제 연결 상태를 재확인했다 — User Pool에 `Google`(type `Google`)이 있고 App Client `idps`가 `["COGNITO","Google"]`, 콜백·로그아웃 URL은 로컬·배포 양쪽 다 등록돼 있다. `.env` 주석의 "Google IdP는 아직 연결 전"은 오래된 내용이다
- 2026-08-24 완료: **모꼬지 Figma 시안 에셋 41장을 `public/images/`에 추가**(`feat/infra` `cea04c9`). 아래 "정적 UI 에셋은 DB도 S3도 아니다" 절 참고
- 진행 중: Amplify GitHub 연동은 완료(아래 앱 ID 참고). Google 로그인 전 구간 실사용 검증(브라우저로 실제 계정 로그인)은 아직 안 했다 — OAuth 동의 화면이 "테스트" 상태면 등록된 테스트 사용자만 된다(아래 "막힌 것" 참고)
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

### 배포 환경에서 절대 URL을 만들지 않는다

**`request.url`의 host는 배포 환경에서 공개 도메인이 아니라 `localhost:3000`이다.** Amplify SSR은 Lambda 안에서 Next 서버를 `localhost:3000`으로 띄우고 그 앞에 CloudFront가 붙는 구조다. 그래서 `new URL("/login", request.url)` 같은 절대 URL을 만들어 `Location`에 실으면 브라우저가 **사용자 PC의 3000번**을 찾아가 "연결을 거부했습니다"로 끝난다.

2026-08-24 배포 환경 실제 응답으로 확인했다.

| 요청 | 수정 전 `Location` | 수정 후 |
|---|---|---|
| `POST /api/auth/logout` | `https://localhost:3000/login` | `/login` |
| `GET /api/auth/callback` | `https://localhost:3000/login` | `/login` |

**원인을 못 찾게 만든 지점**: `redirect_uri`는 `COGNITO_REDIRECT_URI`로 이미 방어돼 있었다(2026-08-23). 그래서 Google 로그인은 Cognito 왕복과 토큰 교환까지 **다 성공한 뒤 홈으로 보내는 마지막 한 줄에서만** 깨졌다. 증상이 "Cognito를 연결했는데 사이트에 연결할 수 없음"으로 보였다.

**규칙**: 앱 내부 경로로 보낼 때는 `lib/cognito.ts`의 `appRedirect(path)`를 쓴다. `Location`에 상대 경로를 넣으면 브라우저가 자기가 접속한 주소를 기준으로 해석하므로(RFC 7231 §7.1.2) 로컬·`main` 배포·프리뷰 브랜치가 도메인이 달라도 전부 맞는다. `NextResponse.redirect()`는 절대 URL을 요구하므로 이 용도에는 쓸 수 없다.

**`APP_ORIGIN` 같은 환경변수로 풀지 않은 이유**: 위 절의 이중 등록(콘솔 + `amplify.yml` grep 목록)이 또 필요해지고, 빠뜨리면 런타임 `undefined`다. 프리뷰 브랜치 배포는 도메인이 달라 아예 깨진다. 상대 경로는 환경변수가 0개다.

**곁들여 고친 것**: 로그아웃이 307이라 브라우저가 `/login`으로 **다시 POST**해 405가 될 수 있었다. 303으로 바꿔 다음 요청이 GET이 된다.

## 정적 UI 에셋은 DB도 S3도 아니다

2026-08-24, 모꼬지 Figma 시안에서 분리한 PNG 41장을 `public/images/`에 넣었다. 요청은 "DB에 올려 달라"였는데 **이미지 바이트가 DB에 들어가는 구조가 아니다.** 스키마의 이미지 필드는 전부 S3 키 문자열이다.

| 필드 | 값의 형태 |
|---|---|
| `PetSkin.imageKeyBase` | `pets/fox` → 코드가 `-{1..4}.png`를 붙인다 |
| `CosmeticItem.imageKey` | `cosmetics/bg-1.png` (확장자 포함) |
| `UserMission.photoKey` | `mission-photos/<userId>/<ts>.png` |
| `Post.imageKey` | 커뮤니티 첨부 |

그림 자체는 `welli-uploads-185236887369` → CloudFront `diros91hbap9v.cloudfront.net`로 나가고, 코드는 `CLOUDFRONT_DOMAIN`과 키를 이어 붙인다(`app/api/pet/route.ts:23`, `lib/profile.ts:33` 등).

**41장은 이 중 어디에도 해당하지 않는다.** 아이콘·로고·장식·말풍선에 대응하는 모델이 스키마에 없고, 펫·치장은 아래처럼 이미 채워졌거나 다른 그림이 필요하다. 그래서 DB 행을 만들지 않고 `public/images/`에 뒀다 — `/images/home_icon.png`로 바로 참조되고, Amplify가 CloudFront로 서빙하며, **`CLOUDFRONT_DOMAIN`이 빈 값인 현재 상태에 영향받지 않는다**(펫 그림이 이모지로 떨어지는 원인이 그 빈 값이다).

**판단 근거 (2026-08-24 CloudFront 실측)**

| 키 | 상태 |
|---|---|
| `pets/fox-1.png` · `pets/fox-4.png` · `pets/bear-arctic-4.png` | 200 — 펫 24장은 이미 다 있다 |
| `cosmetics/bg-1.png` | 403 — **정상이다.** 아래 참고 |
| `backgrounds/forest-autumn-0-0.png` | 200 |

- **캐릭터 아트를 `PetSkin`에 끼우면 안 된다.** `fox_avatar`·`fox_standing`·`fox_laptop`은 포즈 3종이고, `PetSkin`은 성장 4단계를 요구한다(`prisma/seed/items.ts`의 `stageCount: 4`). 북극 변종 그림도 없다. 억지로 넣으면 종당 4장 규칙이 깨져 펫 화면이 폴백된다
- **`cosmetics/bg-1..6.png` 403은 고칠 것이 아니다.** `main`에만 있던 기록(`docs/STATUS.md` 19번 마지막 줄)은 "E가 그 이름으로 6장을 올려야 한다"였는데, **C가 2026-08-22에 반대 방향으로 닫았다** — 시드 키를 실물 경로 `backgrounds/forest-autumn-*.png`에 맞췄다. 그 정정이 `develop`에만 있어서 `main` 기준으로 보면 미해결처럼 보인다. 배경 6종은 이미 상점에 연결돼 있고 이름도 계절 6종으로 확정됐다(`docs/dev/pet.md`). **E가 올릴 이미지는 없다**

원본은 `~/Downloads/mokkoji_components/`(사용자 로컬)이고 `public/images/`와 바이트 동일하다(md5 41건 일치).

## GitHub 레포·브랜치

레포 연결과 브랜치 5개(`feat/diagnosis` `feat/missions` `feat/pet` `feat/community` `feat/infra`) 생성이 끝났다. `DATABASE_URL` 등 실제 값이 든 `.env`는 커밋하지 않으므로, 팀원에게는 E가 개별적으로 값을 공유한다.
