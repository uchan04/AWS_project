# 진행 상황

**모든 세션은 이 문서부터 읽는다.** 그다음 아래 "지금 읽어야 할 문서"만 읽고 시작한다.

최종 갱신: 2026-08-20 (경제 수치 확정 반영, 폐기된 가챠 기획 삭제, 해소된 차단 항목 정리. `develop` = `cb16959`, 남은 것은 D의 6커밋)
현재 단계: **D2 — 인프라 완료, 기능 5개 병렬 착수 (8/20 기능 동결 예정일)**

팀원 인수인계용 단일 문서는 [`docs/인수인계.md`](인수인계.md)에 있다. 새로 합류하거나 노션으로 공유할 때는 그 문서를 쓴다.

---

## 지금 읽어야 할 문서

단계가 바뀌면 이 표를 갱신한다. 여기에 없는 문서는 읽지 않는다.

| 담당 | 읽을 문서 |
|---|---|
| 전원 | `docs/STATUS.md`(이 문서), `CLAUDE.md` |
| A | `docs/dev/diagnosis.md` + `SPEC.md` 2·3·4절 |
| B | `docs/dev/missions.md` + `SPEC.md` 4절 |
| C | `docs/dev/pet.md` + `SPEC.md` 5·6절 |
| D | `docs/dev/community.md` + `SPEC.md` 7·8절 |
| E | `docs/dev/infra.md` + `SPEC.md` 10절 |

`업무분담.md`는 일정·컷 순서를 확인할 때만 읽는다. 매 세션 읽을 필요는 없다.
`아이디어.md`와 연구보고서 PDF는 미션 콘텐츠를 만들 때(A)만 읽는다.

---

## 담당별 상태

| 담당 | 범위 | 상태 | 비고 |
|---|---|---|---|
| A | 진단 + 미션 콘텐츠 + 홈 | 미션 41개, 13문항 + 판정 함수, 조기 종료, 화면 3장 + Figma 값·구성 반영, 진단 API 3종(완료·조회·닉네임) + 화면 연결, **실 DB로 진단→결과→홈 전체 흐름 확인 완료**, 홈 미션을 `GET /api/missions`로 교체(`bdcef94`), 결과 화면 판정 근거 3줄(`298ab56`) | **A 담당 기능은 남은 것이 없다.** 근거 3줄의 Bedrock 실호출만 E의 IAM 키·`BEDROCK_MODEL_ID` 공유 대기다(실패해도 카드만 빠지고 화면은 뜬다). 관리자 교차표와 LLM 2종은 컷 |
| B | 미션 시스템 + 사진 업로드 | **`develop`에 머지 완료**(`3adbea5` → `cb16959`, 2026-08-20). 미션 API 3종, 사진 업로드 presign·verify, 미션 대시보드, 출석, `lib/missions/` 8개 파일. 재화는 `calculateReward()`를 경유한다 | 하단 탭을 사이드바로 교체한 것도 B다(결정 9번은 E 배정이었다). 사이드바 뒷정리 3건은 `51b2897`·`d98fab9`로 끝냈다. 남은 것은 **차단 11번(모바일 부서짐)** + lint 에러 11건 |
| C | 펫 + 스킨 | **`SPEC.md` 5절 기능 완료.** 성장·씨앗 투입·진화 연출, 방치형 자동 획득, 치장 착용·해제, 스킨 구매·전환 + 화면 3장. 스킨·치장 구조 변경(종족 전용 외형 / 치장 종족 무관)은 스키마·실 DB·시드·API·화면까지 반영 완료(2026-08-20, A) | 남은 것은 **치장 구매 라우트**(차단 9), **시드 가격을 확정값으로**(스킨 2,500 / 배경 600 + 배경 등급 통일), `SPEC.md` 2·5·6·11절·`docs/dev/pet.md`·`docs/인수인계.md` 갱신, `scripts/check-pet.ts` 어미 단정 추가. 목록은 `docs/dev/diagnosis.md` 15·17절 |
| D | 커뮤니티 + 챗봇 | **`develop`에 6커밋 미반영**(`d37d12d`. 본인 댓글 삭제, 모달 버그 2건, 문서 2건, 머지 1건). 예측 충돌은 `docs/STATUS.md` 1건뿐이고 코드는 충돌하지 않는다. 기능 구현 끝. 챗봇 Bedrock 스트리밍 연결 완료(2026-08-19). 미션 완료 연동 호출부(`completeMission`)는 주석으로 준비만 해둠 | **`/community`·`/chat`이 프로덕션에서 500이다 — 차단 12번.** `completeMission()`(B) 대기 상태. `docs/dev/community.md`의 "재개 지점" 2번은 `BottomNav` 기준으로 쓰여 있어 낡았다(사이드바로 교체됨). 막힌 항목과 주의사항은 그 문서 상단 참고 |
| E | 인프라 + 인증 | RDS·Cognito·S3+CloudFront·CloudWatch+SNS·Bedrock·auth 실검증·하단 탭 내비 완료, PR #1 머지 + 2차 마이그레이션 + auth 빌드 수정 + 색 토큰 정리 완료 | Amplify GitHub 연동만 남음(브라우저 수동 단계) |

## 전체 차단 사항

지금 프로젝트를 멈춰 세우는 것만 적는다. 해결되면 즉시 지운다.

인프라 차단은 해소됐다(RDS·Cognito·S3·Bedrock 완료). `.env`의 `DATABASE_URL`·`COGNITO_*`·`S3_BUCKET`·`CLOUDFRONT_DOMAIN`·`BEDROCK_MODEL_ID`는 E에게 개별 공유받는다.

해소된 항목(1·2·3·4·5·6·7·8·10번)은 이 목록에서 지웠다. 이력이 필요하면 `git log docs/STATUS.md`를 본다. 남은 것은 아래 8개다.

4. **인증이 붙어 있지 않다. Bearer 헤더 방식으로는 서버 컴포넌트를 인증할 수 없다 (E 담당)** — **2026-08-20에 설명을 고쳤다. 이전 서술("클라이언트가 헤더를 싣기만 하면 된다")은 틀렸다.**
    - `lib/auth.ts:44`가 `Authorization: Bearer`를 읽는다. 그런데 브라우저가 페이지를 여는 문서 내비게이션 요청에는 커스텀 헤더를 붙일 방법이 없다. `fetch`에는 붙지만 링크 클릭·주소창 이동에는 붙지 않는다
    - 서버에서 `getCurrentUser()`를 부르는 페이지가 5개다: `app/chat/page.tsx`, `app/community/page.tsx`, `app/pet/page.tsx`, `app/pet/cosmetics/page.tsx`, `app/pet/skins/page.tsx`. 이 5개는 헤더 방식으로는 원리적으로 인증되지 않는다
    - **해결 방향**: 토큰을 `httpOnly` 쿠키에 담고 `lib/auth.ts`가 `headers()` 대신 `cookies()`를 읽는다. 그러면 페이지와 API가 같은 경로로 인증된다. 헤더 방식을 유지하려면 위 5개 페이지를 클라이언트 컴포넌트로 전환해야 하는데, 마감 이틀 전에 C·D 코드를 뒤집는 작업이다
    - `app/(auth)/` 폴더가 아직 없다. 로그인 화면이 없어 토큰을 받을 곳 자체가 없다
9. **치장 구매 라우트가 없다 (C 담당)** — 가격은 시드·DB에 다 들어갔고 `GET /api/pet/cosmetics`가 `priceAffinity`를 내려주지만 `POST /api/pet/cosmetics/buy`가 없다. 그래서 치장 화면은 여전히 전부 "미획득"으로 보인다. 스킨 쪽(`POST /api/pet/skins/buy`)은 별조각 결제로 고쳐 두었으니 그 파일을 그대로 베끼면 된다 — 친밀도 차감, 종족 검사 없음, `affinityOnly && priceAffinity !== null`만 확인
11. **모바일에서 화면이 부서진다 (B 담당)** — 375px 폭에서 실측했다. `app/components/Sidebar.tsx`의 `aside`가 `width: 240` 고정이라 본문에 **135px만** 남고 내용이 화면 밖으로 잘려나간다. 결정 9번의 "모바일은 아이콘만 남긴 좁은 레일"이 빠졌다. 인라인 스타일로는 미디어 쿼리를 못 쓰니 CSS 클래스가 필요하다
12. **프로덕션에서 `/community`·`/chat`이 500이다 (D 담당)** — `DEV_AUTH_BYPASS`를 끄고 프로덕션 빌드를 띄워 실측했다. 두 페이지가 서버에서 `getCurrentUser()`를 부르는데 감싸지 않아 `UnauthorizedError`가 그대로 터진다(서버 로그 `⨯ Error: 로그인이 필요합니다`). C의 `app/pet/page.tsx`는 `try/catch`로 감싸 안내 화면을 띄우기 때문에 200이다. 인증이 붙기 전까지는 같은 방식으로 감싸는 것이 안전하다
13. **내비 교체 잔여 2건** — (E) 고아가 된 `app/components/BottomNav.tsx` 삭제. `app/layout.tsx`에서 빠졌고 아무도 import하지 않는다(레포 전체 검색으로 확인). `docs/dev/infra.md`에는 아직 "동결"로 적혀 있어 문서도 함께 갱신해야 한다. (B·E) **소유권 결정 필요** — B가 E 소유 공유 파일 3개(`app/layout.tsx`·`app/globals.css`·`.env.example`)를 브랜치에서 고쳤다(`CLAUDE.md` 1절 위반). 충돌은 안 났지만 사이드바를 누가 갖는지 정해야 남은 이틀 동안 둘이 같은 파일을 각자 고치지 않는다
14. **배포 설정이 검증되지 않았다 (E 담당)** — `amplify.yml`이 없어 Amplify의 Next.js 자동 감지에 의존하는 상태다. 이 프로젝트는 Next 16 + Turbopack이라 자동 감지가 이 조합을 처리하는지 확인되지 않았다. `BEDROCK_VISION_MODEL_ID`도 Amplify 환경변수에 등록되지 않았다(`.env.example`에는 있다. `lib/missions/vision.ts:7`이 폴백하므로 죽지는 않는다)
15. **`main`을 받으면 전 API가 500이다 (전원 — `develop` → `main` 머지가 답)** — `origin/main`의 `prisma/schema.prisma`는 삭제된 컬럼을 아직 들고 있다. 그 스키마로 `prisma generate`한 클라이언트는 실 DB에 없는 컬럼을 SELECT하므로, `getCurrentUser()`를 부르는 모든 라우트가 `P2022`로 500이 된다(E가 `/api/diagnosis/me`에서 실제로 겪었다). **`prisma migrate status`로는 안 보인다** — 그 명령은 마이그레이션 히스토리만 비교하고 스키마↔DB 드리프트는 `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`로 봐야 한다. **`migrate deploy`를 다시 돌리지 말 것**(실 DB는 이미 최신이다). 각자 급하면 `git merge origin/develop && npx prisma generate` + dev 서버 재시작으로 풀리고, 근본 해결은 `develop` → `main` 머지다. Amplify가 `main`에서 빌드하므로 **배포 선행 조건**이다
16. **확정된 경제 수치가 코드에 없다 (B·C, 그리고 A·D 중 한쪽)** — 일일 미션 완주 보너스 별조각 60을 주는 지점이 없다(B). 시드의 스킨 가격이 50이고 배경 등급이 갈려 있다(C. 확정값은 2,500 / 600 + 등급 통일). 커뮤니티 글 1개에 친밀도가 40 들어간다 — 미션 보상(A 시드)과 커뮤니티 지급(D)이 각각 20이다. 상세는 `docs/dev/diagnosis.md` 17절

**8/20 5인 머지 — A·B·C·E가 들어갔다.** A는 `develop`(`d8edf2b`)을 받아 충돌 3건(`prisma/schema.prisma`·`prisma/seed/items.ts`·`docs/STATUS.md`)을 해결하고 올렸고(`f9314a5`), 이어 B가 `feat/missions`를 머지했다(`3adbea5`, 이후 사이드바 수정 3커밋으로 `cb16959`). **남은 것은 D의 6커밋 하나다.**

**통합 검증 결과 (2026-08-20, A)**: 충돌 마커 0건, `npm run build` 통과(라우트 31개), 마이그레이션 3개 중복 없음, 실 DB 드리프트 없음(`migrate diff --exit-code`), `check:diagnosis`·`check:pet`·`check:reward` 통과, 화면 7장·API 6종 200 + 실데이터 렌더, 재화 증감은 B도 `calculateReward()` 경유, 유형명 UI 노출 없음, 브라우저 콘솔 에러 0건. **기능은 깨끗하게 합쳐졌다.** `develop`은 각자 받아서 작업해도 안전하다

**배포 가능 여부 실측 (2026-08-20, A)**: `DEV_AUTH_BYPASS=false`로 프로덕션 빌드를 띄워 라우트별 응답을 확인했다.

| 응답 | 경로 |
|---|---|
| 200 | `/` `/diagnosis` `/missions` `/pet` |
| **500** | `/community` `/chat` |
| **401** | `/api/pet` `/api/missions` — 전 API |

**즉 지금 배포하면 빌드는 성공하지만 앱은 쓸 수 없다.** 홈·진단은 뜨지만 데이터가 비고, 커뮤니티·챗봇은 에러 화면이다. 원인은 차단 4번이다. `main` 머지 자체는 fast-forward로 안전하지만(0 앞 / 76 뒤), 배포는 인증을 정한 뒤에 한다

**전원 실행 필요 — `develop` 받는 절차**

```bash
git checkout <자기브랜치> && git merge origin/develop && npx prisma migrate deploy && npx prisma generate && npm run build
```

`develop`에 마이그레이션 `20260820120000_skin_tribe_and_drop_gacha`가 들어갔다(스킨 종족 전용 + 치장 종족 무관). `.env`에 `BEDROCK_VISION_MODEL_ID="us.amazon.nova-2-lite-v1:0"` 한 줄을 추가한다 — `.env.example`에 추가된 유일한 키다. `migrate dev`와 `migrate reset`은 실행하지 않는다. `migrate deploy`만 쓴다.

받은 뒤 데스크톱은 정상인데 모바일이 부서져 보이면 자기 코드 문제가 아니라 차단 11번이다.

**BottomNav 수정**: "진단결과" 탭이 `/diagnosis`(문항 화면)를 가리키던 버그를 `/diagnosis/result`(결과 화면)로 고쳤다(2026-08-19, E)

**`npm run lint` 에러 12건 — B 11건, D 1건, A 0건 (`cb16959`에서 재확인)**: B는 `any` 8건(`lib/missions/*`·미션·업로드 라우트), `set-state-in-effect` 1건(`MissionDashboard.tsx:676`), 나머지 경고. D는 `PostDetailModal.tsx:54`의 같은 `set-state-in-effect`. 사이드바 수정으로 경고 1건이 늘었다 — `Sidebar.tsx:30`의 `getStageEmoji()`가 `stage`를 계산하고 쓰지 않는다(레벨이 올라도 이모지가 안 바뀐다는 뜻이다. B 확인 필요). A의 `app/page.tsx:37`은 `fetchMe().then()` 안으로 옮겨 해소했다. 남의 소유 파일이라 A는 고치지 않았다(`CLAUDE.md` 2절). 빌드는 통과하므로 Amplify 배포는 막히지 않는다

**미확정 — 팀 전체 결정 필요**:
- "결정 변경" 4번(Cognito Google 로그인만)이 `SPEC.md` 10절·`CLAUDE.md` 8절과 충돌한다. 사용자 확인 대기 중이며, 지금 Cognito는 이메일+비밀번호로 이미 구축돼 있다. 방향이 바뀌면 E가 재작업해야 한다
- "결정 변경" 5번(셀프 머지 금지, main은 PR로만)이 `CLAUDE.md` 4절·`업무분담.md`의 기존 셀프 머지 규칙과 충돌한다. 두 문서가 아직 안 바뀌었다. E는 이 규칙 변경을 인지하기 전에 공유 파일들을 `main`에 직접 push했다(과거 관행대로) — 팀 전체가 어느 쪽으로 갈지 정해야 한다

**남은 수동 단계**: Amplify Hosting ↔ GitHub 연동. GitHub App 설치는 브라우저 OAuth 동의가 필요해 계정 소유자가 직접 눌러야 한다. 절차는 `docs/dev/infra.md` 참고

**보안 재검토 필요**: RDS를 팀원 로컬 개발 편의를 위해 Publicly Accessible=true로 설정했다(포트 5432를 0.0.0.0/0에 개방, 강력한 마스터 비밀번호로만 방어). 발표 전에 팀 전체가 재검토할 것 — 상세 이유는 `docs/dev/infra.md` "결정한 것과 이유" 참고

**클라이언트 Authorization 헤더 — 로그인 화면·토큰 보관은 E 담당, 방식 확정 대기**: `lib/auth.ts` 서버 검증은 완료됐으나 클라이언트가 토큰을 싣지 않는다. 이대로 배포하면 전 API가 401이다.

GitHub 원격 — https://github.com/uchan04/AWS_project

## origin 브랜치 상태 (2026-08-20 재확인)

통합 지점을 `main`이 아니라 **`develop`**으로 잡았다. `main`은 `12ff359`에서 멈춰 있고 통합은 `develop`에서 한다.

| 브랜치 | 최신 | `develop` 미반영 | 비고 |
|---|---|---|---|
| `origin/develop` | `cb16959` (8/20) | — | 통합 지점. A·B·C·E 머지 완료 |
| `origin/main` | `12ff359` (8/19) | 0 앞 / 76 뒤 | A(진단)·E(인프라)만. fast-forward로 올라간다. 마감 당일에 처음 합치지 말 것 |
| `origin/feat/pet` | `82b692a` (8/19) | 0 앞 / 59 뒤 | `develop`에 머지됨. C는 작업 재개 전에 받아야 한다 |
| `origin/feat/missions` | `cb16959` (8/20) | 0 | `develop`과 동일 |
| `origin/feat/diagnosis` | `cb16959` (8/20) | 0 | `develop`과 동일 |
| `origin/feat/community` | `d37d12d` (8/20) | **6커밋** | **아직 `develop`에 없다.** 남은 마지막 머지. 예측 충돌은 `docs/STATUS.md` 1건뿐. D가 받은 `develop`은 옛 것이라 머지 전에 `origin/develop`을 다시 받아야 한다 |
| ~~`origin/feat/infra`~~ | — | — | 원격에서 삭제됐다. E는 `main`·`develop`에 직접 push해 왔다 |

**D가 머지할 때 주의**: 예측 충돌은 이 문서 하나다. 담당별 줄과 차단 항목만 살려 손으로 합친다. `prisma/` 파일은 D가 안 건드려 충돌하지 않는다. 머지 뒤 `npx prisma migrate deploy && npx prisma generate`를 돌리고 `npm run build`로 확인한다.

## 결정 변경 (2026-08-19)

1. **동물·색 교체.** 여우 = 건강·정서취약형(주황 `#E8956A`), 고양이 = 독립거주-저소득형(푸른 `#6A95C8`), 곰 = 가족동거형(녹색 `#7AAE82`). Figma 프로토타입 값으로 맞췄다(옛 `#F59E0B`/`#38BDF8`/`#34D399`는 종이색 배경에서 형광으로 떴다). 값은 `lib/types.ts`의 `TRIBE`와 `styles/tokens.css`의 `[data-tribe]` 두 곳에 있다 — 한쪽만 고치지 않는다
2. **관리자 세부유형 8개 추가.** 연구보고서 9유형에서 경계선지능청년 제외. 사용자에게는 여전히 동물 3종만 보인다
3. **아키네이터식 진단.** 문항 13개를 정의하고 유형이 확정되면 조기 종료한다. 무손실이며 실측 평균 9.7문항
4. **Cognito는 Google 로그인만.** `SPEC.md` 10절("소셜 로그인은 쓰지 않는다")·`CLAUDE.md` 8절과 충돌한다. 두 문서 갱신은 사용자 확인 대기
5. **브랜치 규칙.** 담당별 브랜치에 커밋하고 `main`은 PR로만 올린다. 셀프 머지 안 한다
6. **홈 화면 담당은 A**
7. **화면 디자인 기준은 루트 `design.md`, 토큰은 `styles/tokens.css`.** A가 만들었고 진단·결과·홈 3장에 적용했다. 다른 화면도 같은 결로 맞출 담당자는 이 두 파일을 본다. `app/globals.css`·`app/layout.tsx`(E 소유)는 건드리지 않았고 새 npm 의존성도 없다
8. **색·폰트 값의 출처는 Figma 프로토타입**(`isol-design_Figma/README.md` "디자인 규칙" 절). 배경 `#F5F0E8` / 카드 `#FDFBF5` / 주색 `#4B7A5B` / 강조 `#A9542A`, 제목 Gowun Dodum · 본문 Noto Sans KR. hex를 그대로 쓰고 OKLCH로 변환하지 않는다. 프로토타입의 6문항 진단·종족명·특성 설명·직접 `seeds` 증감은 가져오지 않는다(명세 위반)
9. **하단 탭을 없애고 사이드바 하나만 쓴다.** — **적용됨(2026-08-20)**. 다만 E가 아니라 B가 구현했다. 진단 화면 숨김도 `51b2897`로 붙었고 A의 `--nav-h` 되돌리기도 완료다. **모바일 좁은 레일만 아직 없다 — 차단 11번.** E가 "데스크톱=사이드바 / 모바일=하단 탭" 이원화를 제안했으나, 내비게이션 두 벌은 화면마다 어느 쪽이 뜨는지 확인해야 하고 활성 표시·경로가 두 곳에서 갈린다. 마감 3일 전에 감당할 비용이 아니다. 모바일은 같은 사이드바를 아이콘만 남긴 좁은 레일로 줄이고, 진단 문항 화면에서는 내비를 숨긴다. 적용은 E(`app/layout.tsx`), 적용 후 A가 `styles/tokens.css`의 `--nav-h`를 지운다
10. **미션 데이터의 원본은 DB다.** `prisma/seed/missions.ts`는 그 DB를 채우는 시드일 뿐이고, 화면에 41개 문구를 다시 복사하지 않는다. B가 `시드 → DB Mission → GET /api/missions → 화면`으로 간다. A의 홈 미션 미리보기는 그 API가 나오면 그쪽으로 바꾼다(지금은 시드 배열을 직접 읽는 임시 상태이며, `import type`뿐이라 클라이언트 번들에 Prisma는 들어가지 않는다 — 빌드 산출물로 확인)
11. **화면 구성도 Figma에서 가져왔다.** `#EDE5D0` 판 위의 카드(`.hm--canvas` + `.hm-card`), 화면별 폭(진단 680 · 결과·홈 840 · 시작 900px), 넓은 화면 2열 격자, 진행률 바, A·B·C 글자가 붙은 선택지, 결과 마스코트 등장(`bounceIn`), 시작 화면 좌우 분할. 진행률 바의 값은 총 문항 수가 아니라 "유형이 좁혀진 정도"다 — 조기 종료 때문에 총 문항 수를 노출할 수 없다(`SPEC.md` 3절). 통계 카드·출석 캘린더·경험치 바는 가져오지 않았다(데이터 없음. DB 공유 후 채운다)

## 결정 변경 (2026-08-20)

12. **스킨은 종족 전용 외형이다.** 진단으로 정해진 동물은 고정이고 상점에서 사는 것은 같은 동물의 변종뿐이다(여우 → 북극여우, 고양이 → 샴고양이, 곰 → 북극곰). 능력치는 바뀌지 않고 외형만 바뀐다. 친밀도 전용 캐릭터 3종(늑대·삵·판다)과 고유 효과는 없어졌다
13. **화폐를 전용으로 갈랐다.** 스킨은 별조각 전용, 치장 아이템은 친밀도 전용이다. 치장 가격은 등급에서 파생시킨다. 별조각의 소모처는 스킨 상점, 친밀도의 소모처는 치장 상점 하나씩이다
14. **치장 아이템은 종족 구분이 없다.** `CosmeticItem.tribeColor`를 지웠다. 컬러명(노을·새벽·이끼)은 더 이상 종족과 대응하지 않는다
15. **경제 수치를 확정했다.** 일일 미션 전부 완료 = 별조각 60 / 커뮤니티 글 1개 = 친밀도 20 / 하루 친밀도 상한 100 / 스킨 1개 = 별조각 2,500 / 배경 1개 = 친밀도 600(배경 3종은 등급을 통일한다). **코드는 아직 세 곳이 다르다** — 일일 완주 보너스 지급 지점이 없고(B), 시드의 스킨 가격이 50이고 배경 등급이 갈려 있다(C). 상세와 담당은 `docs/dev/diagnosis.md` 17절
16. **친밀도가 글 1개에 40 들어간다.** 미션 보상(`prisma/seed/missions.ts`, A)과 커뮤니티 지급(`app/community/_lib/affinity.ts`, D)이 각각 20을 준다. 확정값은 20이므로 한쪽을 0으로 만들어야 한다 — 어느 쪽을 지울지 팀이 정한다

**스키마 담당 규칙 예외.** `CLAUDE.md` 5절은 마이그레이션을 1인(E)만 실행하라고 한다. 이번에는 팀 합의 후 A가 `prisma/schema.prisma` 수정과 `migrate deploy`까지 실행했다. 마이그레이션은 `20260820120000_skin_tribe_and_drop_gacha` 하나뿐이고 히스토리는 갈라지지 않았다. **나머지 4인은 `git pull && npx prisma migrate deploy && npx prisma generate`만 실행한다.** 다음 스키마 변경은 다시 E가 맡는다

## 마일스톤

| 날짜 | 목표 | 상태 |
|---|---|---|
| 8/14 | 레포·프로젝트·브랜치, auth 스텁, schema 초안 | 완료 (지연 반영) |
| 8/15 | RDS + 마이그레이션 + `DATABASE_URL` 공유, 첫 라이브 배포 | RDS·마이그레이션 완료(8/19). Amplify 라이브 배포는 GitHub 연동 대기 |
| 8/16 | schema 확정, 미션 41개, Cognito | 미션 41개·Cognito 완료. schema는 이미 안정적으로 사용 중 |
| 8/16 | 기능 5개 병렬 착수, 하루 2회 통합 시작 | 8/19부터 착수 가능 (차단 해소) |
| 8/19 | 중간 체크포인트 (컷 판단) | 인프라·진단 완료. B·C 착수 대기가 최대 리스크. A의 4단계(Bedrock 문장 다듬기)는 컷 후보 |
| 8/20 | 기능 동결, 발표 자료 착수 | 5인 브랜치 → `main` 머지 예정 |
| 8/22 | 개발 마감 | |
| 8/26 | 녹화 | |
| 8/28 | 발표 | |

---

## 갱신 규칙

- 하루 2회 통합할 때마다 "담당별 상태"와 "전체 차단 사항"을 갱신한다
- 단계가 넘어가면 "현재 단계"와 "지금 읽어야 할 문서"를 갱신한다
- 세부 내용은 여기에 쓰지 않는다. 담당 기능의 세부는 `docs/dev/<기능>.md`에 쓴다
- 갱신은 `docs:` 커밋으로 남긴다
