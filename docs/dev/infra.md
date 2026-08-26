# 인프라·인증 개발 문서 (담당 E)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 10절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: Next.js 프로젝트, Prisma 6 + 스키마, `lib/auth.ts`(실 Cognito 검증, 쿠키 기반), `lib/prisma.ts`, `lib/api.ts`, `.env.example`, RDS, Cognito, S3+CloudFront, CloudWatch+SNS, Bedrock 확인, Amplify 앱 생성(환경변수 포함), 로그인·가입 화면(이메일+비밀번호), `amplify.yml`(2026-08-20). 내비게이션은 B의 사이드바로 교체됨(하단 탭은 폐기, 아래 "삭제한 파일" 참고)
- 2026-08-23 완료: **Google 로그인 Cognito 측 설정 전부 끝.** Google IdP 생성됨(scopes `profile email openid`, mapping `email→email` `username→sub`), App Client `welli-web-client`에 OAuth 활성화(`AllowedOAuthFlowsUserPoolClient=true`, flow `code`, scopes `openid email profile`, IdP `Google`+`COGNITO`), 콜백·로그아웃 URL 등록. `/oauth2/authorize`가 Google로 302하는 것까지 확인
- 2026-08-24 완료: **배포 환경에서 리다이렉트가 `localhost:3000`으로 튀던 문제 수정**(`fd8c21f`). 아래 "배포 환경에서 절대 URL을 만들지 않는다" 절 참고. Google IdP는 AWS CLI로 실제 연결 상태를 재확인했다 — User Pool에 `Google`(type `Google`)이 있고 App Client `idps`가 `["COGNITO","Google"]`, 콜백·로그아웃 URL은 로컬·배포 양쪽 다 등록돼 있다. `.env` 주석의 "Google IdP는 아직 연결 전"은 오래된 내용이다
- 2026-08-24 완료: **모꼬지 Figma 시안 에셋 41장을 `public/images/`에 추가**(`feat/infra` `cea04c9`). 아래 "정적 UI 에셋은 DB도 S3도 아니다" 절 참고
- 2026-08-24 완료: **`develop` → `main` 배포**(fast-forward 31커밋 `79741d0..d1c1cda`, Amplify job 14 SUCCEED). 배포본 실측 통과 — 이미지 41/41, 페이지 9장 200, 미인증 API 401, 로그아웃 303 `location: /login`, 로그인 401(500 아님 → `SESSION_SECRET` 정상). 아래 "로컬 `.env`에서만 깨지는 것 2건" 절도 함께 참고
- 2026-08-24 완료: **`feat/infra`에 `develop` 26커밋 머지 후 푸시**(`44e9817..6db5435`, 충돌 0건). `main`만 Amplify에 연결돼 있어 배포는 안 걸린다. 미들웨어 리다이렉트 규칙을 정정했다 — 아래 "위 규칙은 Route Handler에만 맞다" 절
- 2026-08-24 완료: **로컬 전수 실행 검증.** 개발 서버(:3000, 인증 13경로)와 프로덕션 빌드(:3100, 보호 6 + 공개 3 + API 3) 양쪽에서 확인. 같은 작업에서 `DEV_AUTH_BYPASS=true`가 빌드를 깨뜨리는 것을 찾았다 — 아래 "로컬 `.env`에서만 깨지는 것" 3번
- 2026-08-24 **미해결**: RDS 커넥션 고갈이 재발했고 조치가 하나도 안 남았다(아래 전용 절). 저절로 회복된 것이라 그대로 재발한다
- ~~진행 중: `PetSkin.avatarKey` — DB 적용만 남았다~~ → **완료 ←2026-08-25 실측(A).** `_prisma_migrations` 9행의 `finished_at`이 전부 채워져 있고 `PetSkin` 6행의 `avatarKey`가 `fox_avatar`·`cat_avatar`·`bear_avatar`로 실제 값이다. **"`main` 머지 전에 적용해야 한다"는 조건은 충족됐다.** 아래 "다음 할 일" 8번도 함께 지울 항목이다
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
6. **(사용자 직접) 로컬 `DATABASE_URL`에 `connection_limit=3` 붙이기 + 팀 5인 공지** — 커넥션 고갈 절 처방 1·2번. 지금 무조치 상태다
7. **(사용자 승인 필요) `idle_session_timeout` 설정과 내 고아 커넥션 12개 정리** — 커넥션 고갈 절 처방 3번. Claude가 두 번 시도했고 권한 정책에 막혔다
8. **(사용자 승인 필요) `avatarKey` 마이그레이션 적용** — `npx prisma migrate deploy && npx prisma generate`. `prisma/schema.prisma` 변경이라 팀 공지 동반
9. **(사용자 직접) `.env.example`에 `SESSION_SECRET`·`DEV_AUTH_BYPASS=false` 추가** — Claude는 `.env*` 접근이 권한 차단이다

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

### 위 규칙은 Route Handler에만 맞다 — 미들웨어는 반대다 (2026-08-24 정정)

위 두 단락("`NextResponse.redirect()`는 이 용도에 쓸 수 없다", "`APP_ORIGIN`으로 풀지 않는다")을 **미들웨어에 그대로 적용하면 500이 난다.** 실제로 그렇게 만들어 봤고 배포본이 죽었다.

Route Handler에서는 `new Response(null, { status: 303, headers: { Location: "/login" } })`처럼 상대 경로 문자열을 그대로 실을 수 있다. 미들웨어는 안 된다 — Next의 Edge 어댑터가 응답의 `Location`을 **`new URL()`로 파싱**해서 상대 경로면 `Invalid URL`로 터진다. 페이지 요청 경로 전체가 500이 되므로 로그인 화면조차 뜨지 않는다.

그래서 `middleware.ts`는 이렇게 한다(`middleware.ts:118-165`).

```ts
const origin = appOrigin(request)                 // lib/oauth.ts
const login = new URL("/login", origin)
return NextResponse.redirect(login, 307)
```

`NextResponse.redirect()`에 절대 URL을 주는 것은 **양쪽 조건에서 다 안전하다.** Next가 요청과 같은 오리진이면 `Location`을 상대 경로로 줄여 내보내고, 다른 오리진이면 절대 URL로 내보낸다. 위 표의 `https://localhost:3000/login` 사고는 `NextResponse.redirect()` 때문이 아니라 **오리진을 `request.url`에서 뽑았기** 때문이었다. 고칠 대상은 오리진의 출처이지 리다이렉트 API가 아니다.

`appOrigin(request)`의 우선순위(`lib/oauth.ts:33-44`): `APP_ORIGIN` → `x-forwarded-host`/`host`(localhost·127.0.0.1은 건너뛴다) → `new URL(request.url).origin`. 두 번째 단계가 있어서 프리뷰 브랜치도 환경변수 없이 맞는다.

**`APP_ORIGIN` 이중 등록 걱정은 해소됐다.** `amplify.yml:15`의 grep 목록에 `APP_ORIGIN`이 들어 있고, 같은 파일 20행이 콘솔 값이 없을 때 `APP_ORIGIN=https://${AWS_BRANCH}.${AWS_APP_ID}.amplifyapp.com`을 합성한다. 콘솔에 아무것도 없어도 브랜치별로 맞는 값이 실린다.

같은 수정을 팀원이 독립적으로 만들어(`6beb63f`) 내 것과 함께 머지됐다(`ea22d9a`). 두 사람이 같은 결론에 도달했다는 뜻이니 이 절을 다시 뒤집지 않는다.

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

## 로컬 `.env`에서만 깨지는 것 2건 (2026-08-24)

`develop`을 로컬로 돌려서 찾았다. **둘 다 배포본은 정상이고 로컬 `.env`만의 문제다.** `.env`는 git 미추적이라 각자 고쳐야 한다.

**1. `SESSION_SECRET`이 없어 로그인이 500이다.** `.env`가 8/20자라 8/21에 생긴 키가 없다. `lib/session.ts:23`이 `if (!value) throw`라 `POST /api/auth/login`이 본문 없는 500을 준다(`docs/STATUS.md` 차단 26). **`.env.example`에도 없어서** `cp .env.example .env`로 시작한 팀원 전원이 걸린다 — `.env.example`은 E 소유이니 여기에 키를 추가해야 한다.

**2. `CLOUDFRONT_DOMAIN`에 `https://`가 없으면 그림이 상대 경로가 된다.** 코드가 `${cloudfront}/${key}`로 그냥 이어 붙인다(`app/api/pet/route.ts:24`, `lib/profile.ts:44` 등 5곳).

| `CLOUDFRONT_DOMAIN` | 브라우저가 요청하는 주소 | 결과 |
|---|---|---|
| `diros91hbap9v.cloudfront.net` | `localhost:3000/diros91hbap9v.cloudfront.net/pets/fox-4.png` | **404** |
| `https://diros91hbap9v.cloudfront.net` | `https://diros91hbap9v.cloudfront.net/pets/fox-4.png` | 200 |

**문서에 오래 적혀 있던 "`CLOUDFRONT_DOMAIN`이 빈 값이라 펫 그림이 이모지로 떨어진다"는 이제 맞지 않는다.** 빈 값이 아니라 **스킴만 없는** 상태라, 이모지 폴백 조건(`cloudfront &&`)을 통과해 버리고 깨진 이미지가 된다. 빈 값보다 나쁘다. Amplify 환경변수에는 `https://`가 붙어 있어 배포본은 처음부터 정상이었다.

로컬 `.env`는 이렇게 둔다.

```
SESSION_SECRET=<임의의 긴 문자열>
CLOUDFRONT_DOMAIN=https://diros91hbap9v.cloudfront.net
DEV_AUTH_BYPASS=false
```

`DEV_AUTH_BYPASS`가 `true`면 미인증 `GET /api/pet`이 401 대신 실데이터를 준다 — 로컬에서 인증 흐름을 검증할 수 없으니 `false`로 둔다(배포본은 `false`다).

**`.env.example`에는 아직 못 넣었다.** `SESSION_SECRET`을 추가해야 하는데(위 1번) Claude 쪽 권한 설정이 `.env*` 파일 읽기·쓰기를 막고 있어 손을 못 댄다. 사용자가 직접 위 3줄을 `.env.example`에 넣어야 `cp .env.example .env`로 시작하는 다음 팀원이 같은 500을 안 만난다.

### 3. `DEV_AUTH_BYPASS=true`면 `npm run build`가 실패한다 (2026-08-24 신규)

세 번째 함정이고, 이건 **로컬에서만 나는 빌드 실패**다. 남의 커밋을 의심하게 만들어서 시간을 크게 먹는다.

```
Error: useSearchParams() should be wrapped in a suspense boundary at page "/signup".
Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
```

**연결 고리**: `DEV_AUTH_BYPASS=true`면 `lib/auth.ts`의 `getCurrentUserWithSkin()`이 고정 유저 스텁을 쓰고 **`cookies()`를 아예 읽지 않는다.** 루트 레이아웃이 동적 API를 하나도 안 쓰게 되므로 Next가 이를 정적 렌더 가능으로 판정하고 38개 페이지를 프리렌더한다. 그 순간 `app/components/Sidebar.tsx`의 `useSearchParams()`가 CSR bailout 규칙에 걸린다. `DEV_AUTH_BYPASS=false`면 `cookies()`를 읽어 루트 레이아웃이 동적이 되고, 라우트가 전부 `ƒ`로 잡혀 빌드가 통과한다.

**왜 원인을 못 찾게 되는가**: 실패하는 페이지가 실행마다 바뀐다(`/_not-found`, `/signup`, `/diagnosis/result`를 번갈아 봤다). 빌드 워커가 병렬이라 먼저 걸린 페이지가 보고되는 것이다. 그래서 "그 페이지를 방금 건드린 사람의 커밋"이 범인처럼 보인다. 실제로 `develop`의 최신 커밋을 의심했고 **아니었다.**

**판정 방법** — 한 줄이면 갈린다. 코드를 고치지 않는다.

```bash
DEV_AUTH_BYPASS=false npm run build   # 통과하면 원인은 내 .env다
```

배포본에는 이 문제가 없다. Amplify 환경변수가 `DEV_AUTH_BYPASS=false`라서 처음부터 전 라우트가 동적이다.

## RDS 커넥션 고갈이 재발한다 — 범인은 Lambda가 아니라 로컬 개발 머신이다 (2026-08-24)

`docs/STATUS.md` 차단 27번과 같은 증상이 다시 났고, **처방을 고쳐야 한다.** 27번은 원인을 "Lambda 인스턴스 53개 × Prisma 기본 풀"로 보고 Amplify `DATABASE_URL`에 `connection_limit=1`을 처방했다. 오늘 실측은 다른 그림을 보여준다.

**증상** — CloudWatch `/aws/amplify/d2ynoyp44lt46h`:

```
PrismaClientInitializationError: Too many database connections opened:
FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute
```

터진 자리는 `prisma.user.findUnique()`(`[/]`·`[getSidebarProfile]`), `prisma.mission.findMany()`, `prisma.userMission.findMany()`, `prisma.attendanceClaim.count()`다.

**`pg_stat_activity` 실측 (2026-08-24 고갈 시점, `max_connections = 79`)**

| 클라이언트 | 개수 | 상태 |
|---|---|---|
| 내 로컬 PC `121.135.170.5` | **22** | idle 21 + active 1 |
| 팀원 로컬 PC `221.143.15.110` | **20** | 전부 idle |
| RDS 내부 (`local`) | 8 | — |
| Amplify Lambda `34.228.145.68` | 5 | — |
| Amplify Lambda `52.201.233.67` | 1 | — |
| **합계** | **56 / 79** | |

**Lambda는 6개뿐이다.** 56개 중 42개가 로컬 개발 머신 2대다. 개발자 5명이 동시에 `next dev`를 띄우면 5 × 약 20 = 100으로 79를 혼자 넘긴다. `connection_limit`을 Amplify에만 걸어도 이 구조는 안 바뀐다.

**Prisma 기본 풀은 `물리 CPU × 2 + 1`이다.** `next dev` 한 대가 10~22개를 잡는다. `docs/STATUS.md` 261행이 이미 이걸 보고만 하고 넘겼다("5인 × 25 + Amplify면 고갈 위험") — 그 예측이 그대로 실현됐다.

**고아 백엔드가 남는다 (이번에 새로 확인).** `next dev`를 죽여도 서버 쪽 백엔드는 `idle` 상태로 남아 `max_connections`를 계속 먹는다. 내 :3000을 죽여 총 56 → 47이 됐지만, **로컬에 5432로 열린 소켓도 살아있는 node 프로세스도 0인데** 내 IP의 idle 12개가 73분(4406초)째 남아 있었다. `lsof -nP -iTCP -sTCP:ESTABLISHED | grep :5432`로 확인했다. `tcp_keepalives_idle = 300`·`count = 2`면 약 6분에 정리돼야 하는데 안 됐다 — 가정용 라우터 NAT가 중간에서 keepalive를 흡수하는 것으로 보인다.

**이번 건은 저절로 회복됐다.** 팀원 PC의 20개가 풀리면서 총 22/79로 내려갔고, 마지막 에러 15:18:00 이후 13분간 0건, `/` 200(0.50s)이다. **고친 것이 아니라 남이 노트북을 닫은 것이다** — 아무 조치도 남지 않았으니 그대로 재발한다.

**이 장애는 밖에서 안 보인다.** 고갈 중에도 `/`·`/login`은 200이고 보호 경로는 307이다. `/`·`/login`은 DB를 안 타거나 실패를 삼키고, 307은 미들웨어가 쿠키만 보고 내보낸다. `curl`로는 완전히 건강해 보이는데 **로그인한 사용자의 모든 페이지가 500**이다. 미들웨어 장애 때와 똑같은 함정이다 — 배포 검증은 반드시 **로그인 상태**로 한다.

### 처방 (우선순위 순, 아직 아무것도 적용 안 됨)

1. **로컬 `.env`의 `DATABASE_URL`에 `connection_limit=3`을 붙인다.** 효과가 가장 크고 프로덕션 지연에 영향이 0이다. 5명 전원이 해야 한다 — `.env`는 git 미추적이라 공지로만 전파된다
   ```
   DATABASE_URL="postgresql://...:5432/welli?connection_limit=3"   # 이미 ?가 있으면 &
   ```
2. **쓰지 않는 `next dev`를 띄워 두지 않는다.** 위 계산이 5 × 20 ≥ 79다. 팀 규칙으로 박아야 한다
3. **DB 롤에 `idle_session_timeout`을 건다** — 고아 백엔드를 스스로 정리하는 유일한 구조적 수단이다. 현재 `0`(무제한)이고 `idle_in_transaction_session_timeout`만 86400000(24시간)으로 걸려 있다. 5분 정도면 Prisma가 다음 쿼리에서 조용히 재연결한다. 공유 프로덕션 DB 변경이라 **사용자 승인 필요**
4. **Amplify `connection_limit`은 마지막에 본다.** 차단 27번의 처방이지만 오늘 실측으로 Lambda 몫은 6개뿐이고, `docs/dev/perf.md`의 계측에서 `connection_limit=1`은 `/missions`를 1086ms로 **느리게 만들었다**. 값을 낮추면 그만큼 직렬화된다 — 원인이 아닌 곳에서 지연을 사는 셈이다
5. **`max_connections` 인상(파라미터 그룹 + 재부팅)은 최후 수단.** `db.t4g.micro` 1GiB에서 커넥션당 메모리를 더 쓰는 것이고, 원인을 안 없앤다

**Claude가 실행하려다 권한 정책에 막힌 것 2건** — 둘 다 공유 프로덕션 인프라 변경이라 차단이 타당하다. 사용자가 직접 실행하거나 명시적으로 허용해야 한다.

- `pg_terminate_backend()`로 내 IP의 고아 idle 커넥션 12개 정리 (대상: `host(client_addr) = '121.135.170.5' AND state = 'idle' AND pid <> pg_backend_pid()`. 팀원·RDS 내부 커넥션은 제외)
- `ALTER ROLE`/`ALTER DATABASE ... SET idle_session_timeout` (위 3번)

## 프로필 아바타는 `PetSkin.avatarKey`로 따로 저장한다 (2026-08-24)

"각 동물의 프로필 이미지를 `cat_avatar`/`bear_avatar`/`fox_avatar`로 바꿔 달라"는 요청을 이렇게 풀었다. **`imageKeyBase`를 덮어쓰지 않았다** — 그게 핵심 결정이다.

| 무엇 | 값 | 출처 |
|---|---|---|
| 펫 성장 4단계·홈 마스코트·미션 카드·스킨 상점 | `PetSkin.imageKeyBase` (`pets/fox`) | CloudFront |
| 프로필 원형 3곳 (사이드바 접힘·펼침, 내 계정 모달) | `PetSkin.avatarKey` (`fox_avatar`) | **Amplify 정적 `public/images/`** |

**왜 덮어쓰지 않았는가**: `imageKeyBase` 하나가 8곳을 먹인다. 아바타는 포즈 1장이라 `-1`~`-4`가 없어서, 덮어쓰면 성장 4단계가 전부 같은 그림이 되거나 404로 이모지 폴백이 된다(위 "정적 UI 에셋" 절 108행이 이미 같은 이유로 경고했다). `lib/profile.ts`의 `imageUrl`도 그대로 뒀다 — 쉼 화면 `app/pet/rest/page.tsx:25`가 그 값으로 방 안의 **펫**을 그린다.

**CloudFront가 아니라 Amplify 정적이다 (2026-08-24 실측).** `cat_avatar.png`·`images/cat_avatar.png`·`pets/cat_avatar.png`·`cat_avatar-1.png` **전부 403**, 같은 시각 `pets/cat-1.png`는 200. 아바타 3장은 CloudFront에 올라간 적이 없고 `public/images/`에 커밋돼 있다. 그래서 `lib/assets.ts`의 `avatarUrl()`은 `cdnUrl()`을 타지 않고 `/images/<키>.png`를 만든다. 같은 오리진(`self`)이라 미들웨어 CSP는 손댈 것이 없다.

- 컬럼은 **nullable, 기본값 없음**이다. `null`이면 사이드바가 `imageUrl`로 되돌아가므로 마이그레이션 전 코드도 그대로 돈다
- 북극 변종 3종도 같은 종족 아바타를 쓴다. 아바타는 종족당 1장뿐이고 대체 그림이 없다
- 백필은 시드가 아니라 **마이그레이션 SQL 안에** 넣었다(`prisma/migrations/20260824170000_petskin_avatar_key/migration.sql`). 팀원 4명과 프로덕션이 `migrate deploy` 한 번으로 같은 값이 된다. 시드 재실행은 미션 카탈로그·치장까지 건드리므로 컬럼 하나 때문에 돌릴 것이 아니다
- 마이그레이션은 **손으로 썼다**(`prisma migrate dev`를 돌리지 않았다. `CLAUDE.md` 5절 — 스키마 담당 1인만 실행한다)

**아직 DB에 안 들어갔다.** `npx prisma migrate deploy`가 권한 정책에 막혔다(공유 프로덕션 DB 쓰기). 코드·스키마·시드·마이그레이션 파일은 다 있고 `npx prisma generate` + `DEV_AUTH_BYPASS=false npm run build`는 통과(exit 0)했다. `prisma/schema.prisma`는 **전원 합의 파일**이라 적용 시 팀 공지가 필요하다.

## GitHub 레포·브랜치

레포 연결과 브랜치 5개(`feat/diagnosis` `feat/missions` `feat/pet` `feat/community` `feat/infra`) 생성이 끝났다. `DATABASE_URL` 등 실제 값이 든 `.env`는 커밋하지 않으므로, 팀원에게는 E가 개별적으로 값을 공유한다.

## 커넥션을 누가 쥐는지 재는 스크립트 (2026-08-26, A) — **E 통보**

`scripts/perf-connby.ts`. `perf-conncheck.ts`는 총량만 준다 — 상한에 부딪혔을 때 필요한 것은 총량이 아니라 **어느 기기가 몇 개를 쥐고 있는지**다. 그게 "끌 대상"을 정한다.

```bash
npx tsx -r dotenv/config scripts/perf-connby.ts
```

**풀을 `connection_limit=1`로 못 박았다 — 고갈 상태에서도 뜬다.** `perf-conncheck.ts`는 2026-08-26에 이 상태에서 죽었다(`FATAL: remaining connection slots are reserved for SUPERUSER`). 재려는 대상이 재는 것을 막는 상황이라 별 파일이 필요했다. 읽기 전용이고 `DATABASE_URL`은 출력하지 않는다.

### 2026-08-26 실측 — 로컬 기기 2대가 Amplify와 맞먹었다

```
app share 76        끄기 전 77 사용 / 여유 −1     ← 조회조차 실패
                    끄기 후 64 사용 / 여유 12
```

| 클라이언트 | 개수 | idle | 최고령 | 정체 |
|---|---|---|---|---|
| `121.135.170.5` | **18** | 18 | 21분 | 팀원 로컬 개발 기기 |
| `221.143.15.110` | **13** | 13 | — | A 로컬 (껐다) |
| AWS IP 15개 | 합 **34** | 34 | 33분 | Amplify Lambda |
| `local / rdsadmin` | 2 | 2 | 6.9일 | RDS 관리 프로세스 |

**로컬 2대 = 31개.** Amplify 34개와 맞먹는다. `18/18`, `34/34`가 전부 `idle`이다 — 부하가 아니라 **반납을 안 하는 것**이 원인이라는 진단이 그대로 재현됐다.

`netstat`으로 교차 확인했다: 내 13개가 **PID 하나**(`next dev`)였다. Prisma 풀은 프로세스가 죽을 때까지 반납하지 않는다 — 창을 닫는 것으로는 안 된다.

**처방은 이미 문서에 있다**(`DATABASE_URL`에 `connection_limit=2` + 재배포). 이 스크립트는 처방이 아니라 계측이다.
