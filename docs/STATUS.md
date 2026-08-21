# 진행 상황

**모든 세션은 이 문서부터 읽는다.** 그다음 아래 "지금 읽어야 할 문서"만 읽고 시작한다.

최종 갱신: 2026-08-21 (흐름 확정: 소개 → 가입/로그인 → 문항 → 결과 → 홈. 자체 DB 계정 + 쿠키 로그인 유지 완료. D 미션 완료 연동 완료, 차단 17·20·22 해소 + 21의 D 몫 해소. C가 `feat/pet`에 `develop`을 머지하고 `/pet`을 Figma 시안으로 이관 + 배고픔 게이지 + **3단 → 4단 진화** + **공유 DB 반영**(차단 24·25 해소) + **차단 19 해소(북극곰 이미지 키)** + **런타임 3흐름 검증 완료 — C는 남은 코드가 없다**. 신규 차단 **26번 — `SESSION_SECRET`이 없어 로그인이 500이다**. 남은 차단은 13·14·21·23·26)
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
| A | 진단 + 미션 콘텐츠 + 홈 | **`develop`에 머지 완료**(`a098c61`, 2026-08-20). 미션 41개, 13문항 + 판정 함수, 조기 종료, 화면 3장 + Figma 값·구성 반영, 진단 API 3종(완료·조회·닉네임) + 화면 연결, **실 DB로 진단→결과→홈 전체 흐름 확인 완료**, 홈 미션을 `GET /api/missions`로 교체(`bdcef94`), 결과 화면 판정 근거 3줄(`298ab56`), 친밀도 이중 지급 제거(`5a2753e`) | **진단 자체는 남은 것이 없다.** 다만 2026-08-21 흐름 변경(소개 → 가입/로그인 → 문항 → 결과 → 홈)으로 A 몫이 다시 생겼다 — 아래 차단 21·22. 홈 소개 화면의 "시작하기"가 미인증이면 `/signup`, 로그인 상태면 `/diagnosis`로 갈리도록 고쳤다(`fetchMeState()`가 401과 진단 전을 가른다). 자체 계정용 `lib/password.ts`·`lib/session.ts`·`scripts/check-auth.ts`도 A가 만들었다. 근거 3줄의 Bedrock 실호출은 IAM 키 대기(실패해도 카드만 빠진다). 관리자 교차표와 LLM 2종은 컷 |
| B | 미션 시스템 + 사진 업로드 | **`develop`에 머지 완료**(`90b386f`, 2026-08-20). 미션 API 3종, 사진 업로드 presign·verify, 미션 대시보드, 출석, `lib/missions/` 8개 파일. 재화는 `calculateReward()`를 경유한다. 마지막 6커밋으로 `exp` 직접 증가 제거(`6495f37`) + `getToday()` UTC 자정 통일(`62340e5`·`d0fa3cb`·`1e4a46d`) + 미션 화살표 위치까지 들어왔다 | 하단 탭을 사이드바로 교체한 것도 B다(결정 9번은 E 배정이었다). 남은 것은 lint 에러 11건 + **차단 17번**(`completion.ts:123`이 `calculateReward()`를 우회한다) |
| C | 펫 + 스킨 | **`SPEC.md` 5절 기능 전부 완료 + `develop`에 머지 완료**(2026-08-20). 성장·씨앗 투입·진화 연출, 방치형 자동 획득, 치장 **구매**·착용·해제, 스킨 구매·전환 + 화면 3장. 구조 변경(종족 전용 외형 / 치장 종족 무관 / 가챠 삭제 / **치장 12종 → 배경 6종**) 반영 완료. `docs/dev/diagnosis.md` 15·17절이 넘긴 C 몫도 전부 처리(치장 구매 라우트, `check-pet` 어미 단정, 시드 가격 확정값, `SPEC.md` 2·5·6·11절, `docs/dev/pet.md`, `docs/인수인계.md`, `업무분담.md`). 고양잇과 변종 스킨은 `샴고양이` → **`북극고양이`**로 개명(2026-08-20). **2026-08-21: `/pet` 화면을 Figma 시안으로 이관 + 배고픔 게이지 구현**(`User.lastFedAt` 한 컬럼 + 순수 함수, `SPEC.md` 5·11절 갱신) + **착용한 배경을 방 배경으로 연결**(미착용 시 기본 방 SVG, 펫은 중앙 하단 고정) + **3단 → 4단 진화**(Lv.25 / 알·아기·청소년·성체. E가 `-4` 이미지는 계획된 것이라고 확인) | **C는 남은 코드가 없다 (2026-08-21).** 차단 24·25 해소로 `/pet`이 정상 화면이 됐고, 같은 날 **차단 19(북극곰 이미지 키)**도 시드 + 실 DB 둘 다 고쳤다(`83a9920`). **런타임 3흐름 검증도 끝났다** — 데모 재화 시드(씨앗 3,000 / 별조각 2,500 / 친밀도 3,600)를 실행하고 진화 연출 Lv.5·15·25(`evolvedTo` 2·3·4가 `exp 0`에 정확히 착지), 치장 구매·착용·슬롯 교체·해제, 스킨 구매 2500 → 0·전환을 다 확인했다. 재화 가격·수급량 확정값도 시드·`check:pet`·문서·**실 DB**에 반영 완료. 남은 것은 **팀 결정 1건**(재진단 후 옛 종족 스킨 — 이제 실제 사례가 공유 DB에 있다)과 **남에게 넘긴 것 2건**(E: `cosmetics/bg-*.png` 6장 업로드 + `CLOUDFRONT_DOMAIN`·`SESSION_SECRET`) |
| D | 커뮤니티 + 챗봇 | **`develop`에 머지 완료**(2026-08-20). 기능 구현 끝 — 챗봇 Bedrock 스트리밍(2026-08-19), 챗봇 전역 오버레이 런처 전환(`f149243`, 임시 `/chat` 라우트 폐기), 본인 댓글 삭제, 미인증 500 수정(`13f3a6a`), 글쓰기 주제 추천(고정 문구), 전체 탭 글쓰기(`GalleryType` 반영). **미션 완료 연동 완료**(2026-08-21) — `DAILY_COMMUNITY_POST`·`DAILY_CHAT` 두 라우트가 `completeMissionByCode({ actor, code })`를 실제로 호출한다 | **D 담당 기능은 남은 것이 없다.** 미션 연동은 주석의 `completeMission(user.id, code)` 대신 확정 시그니처로 새로 썼고, `grantAffinity()` 다음 별도 `try/catch`에 둬 미션 실패가 글·메시지 저장을 롤백시키지 않는다. 응답 형태는 그대로다. `app/layout.tsx`(E 소유) 2줄 변경이 들어 있다 — 차단 13번과 같은 사안. 세부는 `docs/dev/community.md` "재개 지점" |
| E | 인프라 + 인증 | RDS·Cognito·S3+CloudFront·CloudWatch+SNS·Bedrock·auth 실검증·하단 탭 내비 완료, PR #1 머지 + 2차 마이그레이션 + auth 빌드 수정 + 색 토큰 정리 완료. 로그인 화면(이메일+비밀번호/Google) + 쿠키 기반 인증 전환 + `amplify.yml` 완료(2026-08-20) | Amplify GitHub 연동, Google IdP 자격증명(아래 참고) 남음 |

## 전체 차단 사항

지금 프로젝트를 멈춰 세우는 것만 적는다. 해결되면 즉시 지운다.

인프라 차단은 해소됐다(RDS·Cognito·S3·Bedrock 완료). 단 **AWS 리소스 생성이 끝난 것과 `.env`에 값이 온 것은 다르다** — 2026-08-20 로컬 `.env` 확인 결과 채워진 값은 `DATABASE_URL`(+`AWS_REGION`·`BEDROCK_REGION`·`DEV_AUTH_BYPASS=true`)뿐이고 `COGNITO_USER_POOL_ID`·`COGNITO_CLIENT_ID`·`BEDROCK_MODEL_ID`·`BEDROCK_VISION_MODEL_ID`·`S3_BUCKET`·`CLOUDFRONT_DOMAIN`은 **전부 빈 문자열**이다. E에게 개별 공유받아야 한다. 코드가 실제로 읽는 키는 9개이고 `.env`에 다 있다(키 누락은 없다 — 값만 없다). 영향:
- **빌드·DB·펫·미션·진단은 막히지 않는다.** `DEV_AUTH_BYPASS=true` + `lib/auth.ts` 지연 생성(차단 3) 덕이다
- **챗봇(D)은 로컬에서 실호출이 안 된다.** `app/api/chat/stream/route.ts:25`가 `BEDROCK_MODEL_ID` 없으면 `BEDROCK_NOT_CONFIGURED` 500으로 끊는다. 죽지는 않지만 AI 응답은 못 본다
- **사진 미션(B)은 업로드가 안 된다.** `S3_BUCKET`이 빈 값이다. 비전 모델은 `lib/missions/vision.ts:7`이 `us.amazon.nova-2-lite-v1:0`으로 폴백하므로 `BEDROCK_VISION_MODEL_ID`는 비어도 된다
- 실제 Cognito 로그인 경로도 검증 불가(차단 4와 같은 뿌리)

**A에게 알림 — C가 `lib/types.ts`를 `feat/pet`에서 고쳤다 (2026-08-21).** 4단 진화 때문에 `EVOLUTION_LEVEL`에 `STAGE4: 25`를 넣고 `evolutionStageFor()`에 분기를 하나 추가했다. `lib/types.ts`는 A 소유 공유 파일이라 원래는 A가 `main`에 직접 커밋해야 하지만(`CLAUDE.md` 1절), 마감이 하루 남아 **사용자 승인을 받고 C가 브랜치에서 직접 고쳤다.** 규칙을 바꾼 것이 아니라 이번 한 번의 예외다. **건드린 것은 성장 곡선 블록(74~84줄 부근) 한 군데뿐이고** `TypeCode`·`TRIBE`·`Adjective`·닉네임 상수는 그대로다. A가 같은 파일을 고쳤다면 머지 시점에 이 파일을 먼저 확인한다.

**3단 → 4단 진화 확정 (2026-08-21).** 4단 = Lv.25, 단계 이름은 **알·아기·청소년·성체**다(이전 아기·청년·전설은 폐기). 누적 씨앗 3,000 = 약 27일이라 스킨 39일·배경 36일과 세 축이 모인다. 계기는 S3 실측에서 나온 종당 4장(`-1`~`-4`)이고, **4단 진화가 계획된 것임을 E가 확인**해 줬다 — 어긋난 쪽은 S3가 아니라 코드·명세였다. `SPEC.md` 5·11절 갱신 완료. 임계값의 유일한 출처는 `lib/types.ts`의 `EVOLUTION_LEVEL`이고 `npm run check:pet`이 못 박는다.

**`.env.example`의 `DATABASE_URL` 샘플에 `sslmode=require`가 없다 (E에게 알림, 2026-08-20 C 확인)**: 샘플은 `?schema=public`으로 끝나는데 실제 RDS는 SSL을 요구한다. `cp .env.example .env`로 시작한 사람은 접속에 실패한다. 동작하는 형태는 `...:5432/welli?schema=public&sslmode=require`다. `.env.example`은 E 소유라 C가 고치지 않았다

해소된 항목(1·2·3·**4**·5·6·7·8·**9**·10·**11**·**12**·**15**·**16**·**17**·**18**·**19**·**20**·**22**·**24**·**25**번)은 이 목록에서 지웠다. 이력이 필요하면 `git log docs/STATUS.md`를 본다. 남은 것은 아래 5개(13·14·21·23·26)다. 21번은 D 몫만 해소됐고 B 몫이 남아 있다. **남은 5개 중 C 몫은 0개다.**

**번호가 한 번 밀렸다 (2026-08-21 머지).** C가 `feat/pet`에서 21·22번으로 적었던 두 건(`lastFedAt` 마이그레이션, `PetSkin.stageCount`)은 `develop`이 이미 그 번호를 다른 내용으로 쓰고 있어 **24·25번으로 옮겼고, 옮긴 당일 둘 다 해소됐다.** 그다음 번호가 26번이다.

**차단 4번(인증) 해소** — E가 `lib/auth.ts`를 `cookies()`로 바꾸고 로그인·회원가입 화면과 `/api/auth/*` 5종을 붙였다(`ba9287a`). 서버 컴포넌트 5개와 API가 같은 경로로 인증된다.
**차단 11번(모바일) 해소** — `app/components/Sidebar.module.css`의 `768px` 미디어 쿼리로 아이콘 레일이 붙었다(B의 `468f17f`). A의 머지로 `develop`에 들어왔다.
**차단 15번(`main` 스키마 드리프트) 해소** — E가 `develop`을 `main`에 올리고 `main`을 다시 `develop`에 머지했다(`152dbae`). `main`은 `develop`에 전부 포함된다.

~~1. 공유 DB에 옛 동물 매핑이 이미 들어가 있다~~ — 해소(2026-08-20, A). 실 DB를 다시 읽어 보니 확정 매핑과 새 이름(노을·새벽·이끼)이 이미 들어가 있었고 `main`의 시드 *파일*만 옛 값이었다. 스킨·치장 구조 변경과 함께 시드를 확정 값으로 맞췄고, 유저 `밤바다`는 `typeCode=INDEPENDENT_LOW_INCOME` / 활성 펫 **고양이**로 이미 일치해 손댈 것이 없었다. 상세는 `docs/dev/diagnosis.md` 15절

~~6. 가챠 삭제 결정에 따른 스키마 드리프트~~ — 해소(2026-08-20, A). `20260820120000_skin_tribe_and_drop_gacha` 마이그레이션이 `GachaPull` 테이블과 `User.heroPity`·`legendPity`를 실 DB에서 DROP했다. `prisma migrate diff --exit-code`로 드리프트 없음 확인

~~7. `npm run db:seed`가 실패한다~~ — 재현되지 않는다(2026-08-20 확인). `npm run db:seed`가 `.env`를 읽고 그대로 통과한다(`스킨 6종, 치장 12종 반영 / 미션 41개 반영 / seed 완료`). `tsx` 4.x가 `.env`를 자동으로 읽는다. `package.json`은 그대로 둔다

~~8. 치장 획득 경로와 별조각 소모처가 없다~~ — **경로는 정해졌다**(2026-08-20 팀 결정). 치장은 친밀도 전용 상점, 스킨은 별조각 전용 상점이다. 결정 변경 13번 참고. **구현은 스킨 쪽만 끝났다** — 아래 9번

**재화 가격·수급량 확정값 (2026-08-20 팀 결정, C 반영)**: 스킨 3종 = **별조각 2500** / 치장 = 친밀도, 등급 파생 **COMMON 600 · RARE 1000 · EPIC 1800 · LEGENDARY 2800**(배경 6종 합계 3600) / **일일 미션 전체 완료 = 별조각 60** / 글 작성 친밀도 20 · 일 상한 100. 수급은 별조각 약 63.6/일(스킨 39일), 친밀도 최대 100/일(배경 전부 36일)이다. 가격의 유일한 출처는 `prisma/seed/items.ts`(`VARIANT_PRICE_SHARDS`·`PRICE_BY_RARITY`)이고 `npm run check:pet`이 값과 등급 오름차순을 단정한다. 친밀도 쪽은 코드가 이미 확정값이라 손댄 것이 없다(`POST_AFFINITY = 20`·`AFFINITY_DAILY_CAP = 100`). **실 DB 반영도 끝났다**(2026-08-20 `npm run db:seed`) — 스킨 3종 2500, 치장 6행 600, 옛 치장 12행 삭제.

**치장을 12종에서 배경 6종으로 줄였다 (2026-08-20, C)**: 이름 `배경1`~`배경6`, 전부 `BACKGROUND` 슬롯 · `COMMON` = 각 친밀도 600(합계 3600). 모자·목도리는 컷했다(이미지 12장을 8/22까지 만들 수 없다). `Slot` enum의 `HAT`·`SCARF`는 스키마에 그대로 둬서 **마이그레이션이 없다.** `seedItems()`의 `pruneCosmetics()`가 시드 목록에서 빠진 행을 지우고(보유자 있는 행은 경고만) 6종을 넣는다. **실 DB 반영 완료**(2026-08-20 `db:seed`) — 옛 12행은 보유자가 0이라 전부 삭제됐고 `배경1`~`배경6`만 남았다. 세부는 `docs/dev/pet.md` "치장 12종 → 배경 6종" 절.

~~9. 치장 구매 라우트가 없다~~ — 해소(2026-08-20, C). `POST /api/pet/cosmetics/buy` + 화면 구매 버튼을 구현했다. 친밀도 차감(조건부 `updateMany`로 연타 방어), 종족 검사 없음, `affinityOnly && priceAffinity !== null` 확인, `calculateReward()` 미경유(소비), `User.affinityToday`는 건드리지 않는다(일일 상한 카운터 우회 방지). `GET /api/pet/cosmetics`가 `affinity`를 같이 내려준다. 상세는 `docs/dev/pet.md` "치장 구매" 절

~~별조각 60(일일 미션 전체 완료)이 미구현이다~~ — 해소(2026-08-20, B의 `447957d`). `lib/missions/completion.ts`가 일일 미션을 전부 완료한 순간 `starShards: { increment: 60 }`을 준다. 하루 한 번만 걸린다(`UserMission` 유니크 제약이 재완료를 막는다). **이걸로 별조각 수급 63.6/일이 성립하고 스킨 2500이 39일이 된다** — 그전까지는 출석 3.6/일뿐이라 약 700일이었다. 단 이 증감이 `calculateReward()`를 우회한다 → 차단 17번

~~12. 프로덕션에서 `/community`·`/chat`이 500이다~~ — 해소(2026-08-20, D). `/community`는 `getCurrentUser()`~`listGalleryPosts()`를 `try/catch`로 감싸 "로그인이 필요해요" 안내를 렌더한다(C의 `app/pet/page.tsx`와 같은 패턴, `export const dynamic = "force-dynamic"` 포함). `/chat`은 임시 라우트였고 전역 오버레이(`ChatLauncher`)로 대체하며 삭제했다 — 이제 404다

**차단 16번(확정 경제 수치 어긋남) 해소** — 세 갈래가 다 닫혔다. C 몫(스킨 2500 / 배경 COMMON 600)은 `53c23ed`, A·D 몫(글 1개 친밀도 40)은 A가 미션 시드 `rewardAffinity`를 0으로 내려 지급 지점을 D의 `POST_AFFINITY = 20`·`CHAT_TURN_AFFINITY = 5` 한 곳으로 모았다(`5a2753e`, 실 DB 2행도 같이 갱신). B 몫(`exp` 직접 증가)은 `6495f37`이 들어오며 사라졌다.
**차단 18번(강제 push로 되감긴 `develop`) 해소** — B가 `feat/missions`를 다시 머지했다(`90b386f`). `origin/feat/missions`는 이제 `develop` 미반영 0건이다. **공유 브랜치(`main`·`develop`)에 `--force`를 쓰지 않는다**는 규칙만 남는다.

남은 것은 아래 5개다.

13. ~~고아가 된 `app/components/BottomNav.tsx` 삭제~~ — 해소(2026-08-20, E). 파일 삭제 완료, `docs/dev/infra.md`도 같이 갱신했다. **남은 것**: (B·E) **소유권 결정 필요** — B가 E 소유 공유 파일 3개(`app/layout.tsx`·`app/globals.css`·`.env.example`)를 브랜치에서 고쳤다(`CLAUDE.md` 1절 위반). 충돌은 안 났지만 사이드바를 누가 갖는지 정해야 남은 이틀 동안 둘이 같은 파일을 각자 고치지 않는다
14. **배포 설정이 검증되지 않았다 (E 담당)** — `amplify.yml`은 들어왔다(`f0a8634`). 다만 Amplify가 `main`에 연결되지 않아 이 파일로 실제 빌드가 도는 것은 아직 확인되지 않았다. `BEDROCK_VISION_MODEL_ID`도 Amplify 환경변수에 등록되지 않았다(`.env.example`에는 있다. `lib/missions/vision.ts:7`이 폴백하므로 죽지는 않는다)
~~17. 일일 완주 보너스가 `calculateReward()`를 우회한다~~ — 해소(2026-08-20, E). `lib/missions/completion.ts`가 `starShards: { increment: 60 }` 직접 증감 대신 `calculateReward(actor.activePetSkin, { starShards: 60 })`을 거치도록 고쳤다. 값은 그대로 60이지만(스킨 고유 효과 없음), 앞으로 별조각 배율 스킨이 생기면 이 보너스에도 자동 적용된다
~~19. 북극곰 스킨 이미지 키가 S3에 없는 경로를 가리킨다~~ — **해소(2026-08-21, C. 사용자 승인 후 적용, `83a9920`).** 시드를 `pets/bear-polar` → `pets/bear-arctic`으로 고치고 실 DB `imageKeyBase`도 제자리 `UPDATE`했다(`PetSkin.id` 유지 확인 — 보유 이력·착용 상태가 끊기지 않는다). **6종 전부 S3 실제 키와 일치한다.** `lib/pet.ts` 주석과 `SPEC.md` 5절 이미지 줄도 같이 정정했다 — 이제 펫 그림이 이모지로 떨어지는 조건은 `CLOUDFRONT_DOMAIN`이 빈 값일 때 하나뿐이다. 실측 표는 `docs/dev/pet.md` "S3 펫 이미지 실측" 절
   - **덤으로 나온 것이 4단 진화로 이어졌다.** 종당 이미지가 4장(`-1`~`-4`, 6종 전부)이었고, **E가 4단 진화가 계획된 것이라고 확인**해 줘서 어긋난 쪽이 S3가 아니라 코드·명세임이 드러났다. 3단 → 4단으로 바꿨다(아래 25번, `SPEC.md` 5·11절)
   - A가 지적한 `docs/dev/pet.md:110`의 "cat-arctic 9장 다 아직 없다"는 기록도 함께 정정했다(취소선 + 실측 표). 이미지는 6종 전부 올라와 있다
   - **하나가 남았다 (E 담당): `cosmetics/bg-1.png`~`bg-6.png`가 S3에 없다(403).** 배경 치장 이미지가 아직 안 올라왔다 — 착용해도 기본 방 SVG로 폴백하므로 깨지지는 않는다(2026-08-21 구매·착용 실측에서 확인). E에게 이 이름 그대로 요청해 둔 상태다. **차단은 아니다** — 이름만 맞으면 코드는 더 안 고친다
~~20. 로그인·회원가입 화면에 챗봇 버튼이 뜬다~~ — 해소(2026-08-21). 최종 구현은 **A/E의 허용 목록 방식**이다 — `app/chat/_components/ChatLauncher.tsx`가 `ALLOWED_PREFIXES = ["/missions", "/pet", "/community"]` + `pathname === "/"`만 허용하므로 `/login`·`/signup`은 목록에 없어 자동으로 제외된다. D가 `feat/community`에서 먼저 고쳤던 숨김 목록 방식(`c8b4d08`, `HIDDEN_PATHS = ["/diagnosis", "/login", "/signup"]`)은 이 머지에서 허용 목록 쪽으로 대체됐다 — 화면이 늘 때마다 숨김 목록에서 빠뜨리는 문제가 없어서다. 추가로 `useEffect`가 `GET /api/diagnosis/me`를 확인해 진단 미완료(미인증 포함)면 버튼을 아예 띄우지 않는다. 상세는 `docs/dev/community.md` "로그인 화면 챗봇 버튼 숨김"

## 2026-08-21 흐름 변경으로 생긴 차단

확정 흐름: **소개(`/`) → 가입/로그인 → 문항 → 결과 → 홈**. 홈에 닿기 전에는 사이드바·챗봇 버튼이 없어야 한다.

21. **`/diagnosis/result`에 사이드바가 뜬다 (B 담당. D 몫은 해소)** — 2026-08-21 브라우저 실측: `/diagnosis/result`는 `aside` 1개 + "마음 친구 열기" 1개, `/login`은 챗봇 1개(위 20번), `/diagnosis`는 둘 다 0개다. 결과 화면은 아직 홈이 아니라 진단의 마지막 장이므로 둘 다 숨겨야 한다. **D 몫(챗봇 버튼)은 해소됐다** — 위 20번과 같은 변경으로 `ChatLauncher`가 허용 목록 방식이 되면서 `/diagnosis/result`가 목록에 없어 버튼이 렌더되지 않는다. **B 몫은 그대로 남는다** — `app/components/Sidebar.tsx:106`의 `pathname === "/diagnosis"`를 경로 목록으로 바꿔 `/diagnosis/result`도 숨겨야 한다(한 줄이다). 경로 숨김은 **A 소유 파일이 아니라 A가 고치지 않았다**(`CLAUDE.md` 2절). 다만 같은 파일의 **미인증 표시 버그는 A가 고쳤다(B에게 통보 필요)** — 401 본문을 폴백으로 메워서 로그인 전에도 `익명 / 미분류 / Lv.1 / 씨앗 0개 / 로그아웃`이 떴다. `res.ok`를 확인해 실패면 `setProfile(null)`로 두고, 로그아웃 버튼의 `alert(…)`를 실제 `POST /api/auth/logout`으로 바꿨다. 상세는 `docs/dev/diagnosis.md` 19절
22. ~~**자체 DB 계정 컬럼이 공유 DB에 없다**~~ — **해소(2026-08-21, A가 E 합의로 적용)**. `prisma/migrations/20260821020000_user_email_password/`가 `User`에 `email TEXT UNIQUE`·`passwordHash TEXT`를 더한다. 둘 다 nullable이라 기존 행에 영향이 없다. 공유 RDS에 `migrate deploy` 완료(마이그레이션 5개). **다른 4인은 `git pull && npx prisma migrate deploy && npx prisma generate`.** 이어서 가입·로그인이 자체 DB 계정으로 동작한다(`/signup`은 Cognito `AdminCreateUser`를 쓰지 않는다 — IAM 자격증명이 없어 로컬에서 가입이 아예 안 됐고, 확정 흐름상 가입 직후 `User` 행이 있어야 한다). Google 로그인만 Cognito를 계속 쓴다. **팀 공용 테스트 계정: `test@welli.local` / `welli-test-1234`** (공유 개발 DB 전용. 심사·배포 전에 삭제한다. 재생성은 `npx tsx scripts/create-local-user.ts`). `DEV_AUTH_BYPASS`는 이제 쓰지 않는다 — 로컬 `.env`도 `false`다
23. **자체 로그인의 보안 항목을 의도적으로 미뤘다 (팀 결정, 2026-08-21)** — 지금 있는 것: scrypt 해싱(`lib/password.ts`), HMAC 서명 세션 쿠키(`lib/session.ts`, `SESSION_SECRET` 없으면 즉시 throw), `scripts/check-auth.ts` 단정 20건. **미룬 것**: 로그인 시도 횟수 제한, 비밀번호 재설정, 세션 즉시 무효화(DB 세션 표가 없어 만료 전 강제 로그아웃이 안 된다), 이메일 소유 확인. 기능이 붙은 뒤에 다시 본다. `DEV_AUTH_BYPASS`는 배포 환경에서 절대 `true`가 되면 안 된다 — 모든 방문자가 같은 계정으로 들어온다

## 2026-08-21 펫 4단 진화·배고픔으로 생긴 차단 — 둘 다 해소

24. ~~**`lastFedAt` 마이그레이션이 실 DB에 안 들어갔다 — `/pet`이 에러 카드다**~~ — **해소(2026-08-21, C. 사용자 승인 후 적용)**. `20260821090000_pet_last_fed_at`(nullable 컬럼 추가 한 줄)을 `npx prisma migrate deploy`로 넣었다. `migrate dev`·`migrate reset`은 쓰지 않았다(`CLAUDE.md` 5절). `/pet`은 이제 200 + 정상 화면이다.
    - **E의 지적이 실제로 걸렸다.** `feat/pet`에 `develop`의 `20260821020000_user_email_password`가 없어서 로컬 이력과 DB 이력이 갈라져 있었고(`migrate status`가 "DB에는 있는데 로컬에 없다"로 잡는다) 그 상태로는 `deploy`가 거부한다. **`develop`을 먼저 머지해서** 마이그레이션 6개가 다 보이는 상태로 돌렸다. 충돌은 `PetView.tsx`(양쪽 줄을 다 살렸다)와 이 문서(차단 번호)뿐이었다
    - **받는 쪽 4인: `git pull && npx prisma migrate deploy && npx prisma generate`.** 컬럼은 이미 들어갔으므로 `deploy`는 "적용할 것 없음"으로 끝나지만 **`generate`는 꼭 돌린다** — 안 돌리면 각자의 Prisma Client가 `lastFedAt`을 몰라 `/pet`이 타입 에러를 낸다
25. ~~**실 DB의 `PetSkin.stageCount`가 아직 3이다 — 4단 진화가 화면에 안 나온다**~~ — **해소(2026-08-21, C. 사용자 승인 후 `npm run db:seed`)**. `upsert`가 6행을 덮어써 여우·고양이·곰 + 북극 3종 전부 `stageCount = 4`다. 실 화면 확인 결과 진화 단계 카드 4장이 `알` Lv.1~4 / `아기` Lv.5~14 / `청소년` Lv.15~24 / `성체` Lv.25+로 뜬다. 스킨 가격(기본 `null` / 북극 2500)과 치장 6종 600도 그대로다. 북극곰 `imageKeyBase`는 **차단 19번이라 손대지 않았다.** 상세는 `docs/dev/pet.md` "런타임 검증"

**26. `.env`·`.env.example`에 `SESSION_SECRET`이 없어 로그인이 500이다 (E 담당, 2026-08-21 C 확인)** — `develop`을 받은 뒤 `POST /api/auth/login`이 **본문 없는 500**을 준다. 원인은 `lib/session.ts:23`의 `if (!value) throw new Error("SESSION_SECRET이 설정되지 않았습니다")`이고, 로컬 `.env`에 그 키가 아예 없다. **`.env.example`에도 없다** — `cp .env.example .env`로 시작한 사람은 로그인이 안 되고, 이게 지금 `develop`을 받은 4인 전원에게 걸린다. `.env.example`은 E 소유라 C가 고치지 않았다(`CLAUDE.md` 1절). **Amplify 환경변수에도 등록해야 한다**(차단 14번과 같은 묶음 — 없으면 배포본에서 로그인이 전부 500이다). C는 로컬 `.env`에만 임시값을 넣어 검증을 이어갔다.

**펫 런타임 검증 완료 (2026-08-21).** 프로덕션 빌드 + 실 DB + 팀 공용 계정으로 확인했다. 1차: `/pet` 200, 4단 카드 4장, 배고픔 89 → 투입 후 100, 씨앗 15개 투입 `Lv.3 exp 200 → Lv.4 exp 50`, 잔액 초과 `400`, 방치형 빈 상태 `claimed 0`, 치장 목록 6종 600, 없는 스킨 `404`. 2차(재화 시드 후): **진화 3경계**가 `+25 → Lv.5 evolvedTo 2` / `+950 → Lv.15 evolvedTo 3` / `+1950 → Lv.25 evolvedTo 4`로 전부 `exp 0`에 정확히 착지했다(누적 곡선 100·1,050·3,000 실증), **치장** 구매 600 × 2 → 착용 → 슬롯 교체 시 앞것 자동 해제 → 해제, 재구매 `400 ALREADY_OWNED`, **스킨** 2500 → 0 구매 → 전환 후 `imageKeyBase pets/fox-arctic`. `affinityToday`가 소비 1,200에도 50에서 안 움직여 **일일 상한 우회 방어**까지 확인됐다. 못 본 것은 방치형 실제 수령 하나(별개의 DB 쓰기 필요)이고, 펫 그림은 `CLOUDFRONT_DOMAIN`이 빈 값이라 여전히 이모지로 떨어진다.

**데모 계정 재화 시드값 확정 (2026-08-21, C).** 열려 있던 팀 결정 항목을 닫았다 — **씨앗 3,000 · 별조각 2,500 · 친밀도 3,600**이다. 전부 `SPEC.md` 5절 수급표의 소모처 값에서 파생했다(4단 누적 / 스킨 1종 정가 / 배경 6종 합계). **레벨·경험치는 심지 않는다** — 미리 올려 두면 진화 연출을 녹화할 장면이 사라진다. 값의 유일한 출처는 `scripts/seed-demo-currency.ts`이고 `SPEC.md` 5절 "데모 계정 재화 시드값" 절에 표로 있다. **실행 완료 (2026-08-21, 사용자 승인 후).** 출력은 `씨앗 0 → 3000 / 별조각 0 → 2500 / 친밀도 50 → 3600 / 레벨 Lv.4 exp 150 (건드리지 않았다)`이고, 이걸로 펫 3흐름 검증이 다 돌았다(위 절). **검증이 재화를 다 썼고 레벨이 25까지 올라갔으므로 8/26 녹화 계정은 `test@welli.local`과 분리하는 편이 낫다** — 이 계정은 이후 검증에도 계속 쓰인다.

**8/20 5인 머지 — A·B·C·D·E가 전부 들어갔다.** A는 `develop`(`d8edf2b`)을 받아 충돌 3건을 해결하고 올렸고(`f9314a5`), B가 `feat/missions`를 머지했고(`3adbea5` → `cb16959`), E가 `develop`을 `main`에 올린 뒤 `main`을 다시 머지했다(`152dbae`). 이어 A가 진단 근거 3줄과 B 복구분을 올렸다(`a098c61`). D가 `feat/community`를 머지했고(`563ab15`), C가 그 위에 `feat/pet`을 머지했고, B가 마지막 6커밋을 올렸다(`90b386f` → `773262d`). **다섯 브랜치 전부 `develop` 미반영 0건이다.** `docs/STATUS.md`가 매번 충돌하는데, 코드는 아직 한 번도 충돌하지 않았다 — 이 문서만 손으로 합치면 된다.

**5인 머지본 검토 결과 (2026-08-20, A)**: 충돌 마커 0건, `npm run build` 통과, `check:diagnosis`·`check:pet`·`check:reward` 통과, 마이그레이션 4개 중복 없음, 실 DB 드리프트 없음(`migrate diff --exit-code`). 기능 상으로 발견한 실제 결함은 두 개뿐이고 둘 다 아래 차단 19·20에 적었다(북극곰 이미지 키, 로그인 화면의 챗봇 버튼). 그 외 잔가지: `app/community/_lib/gallery.ts`의 `canWriteToGallery()`는 호출부가 0건인 죽은 export이고, `app/api/community/posts/route.ts:56`·`app/api/chat/messages/route.ts:62`의 `completeMission` 호출은 아직 주석이다(`completeMissionByCode({ actor, code })`로 시그니처가 다르니 그대로 풀지 말 것).

**통합 검증 결과 (2026-08-20, A)**: 충돌 마커 0건, `npm run build` 통과(라우트 31개), 마이그레이션 3개 중복 없음, 실 DB 드리프트 없음(`migrate diff --exit-code`), `check:diagnosis`·`check:pet`·`check:reward` 통과, 화면 7장·API 6종 200 + 실데이터 렌더, 재화 증감은 B도 `calculateReward()` 경유, 유형명 UI 노출 없음, 브라우저 콘솔 에러 0건. **기능은 깨끗하게 합쳐졌다.** `develop`은 각자 받아서 작업해도 안전하다

**배포 가능 여부 실측 (2026-08-20, A)**: `DEV_AUTH_BYPASS=false`로 프로덕션 빌드를 띄워 라우트별 응답을 확인했다.

| 응답 | 경로 |
|---|---|
| 200 | `/` `/diagnosis` `/missions` `/pet` |
| **500** | `/community` `/chat` |
| **401** | `/api/pet` `/api/missions` — 전 API |

**이 실측은 차단 4번(Bearer 헤더) 시절 것이다.** E의 쿠키 전환(`ba9287a`)으로 원인은 없어졌고 로그인 화면도 붙었다. 다만 로그인해서 200이 뜨는지는 아직 실측하지 않았다 — 다시 재보고 이 표를 갱신할 것. 위 표의 `/community` 500은 D의 `try/catch`로 해소됐고(차단 12), `/chat`은 라우트 자체가 없어져 404다

**전원 실행 필요 — `develop` 받는 절차**

```bash
git checkout <자기브랜치> && git merge origin/develop && npx prisma migrate deploy && npx prisma generate && npm run build
```

`develop`에 마이그레이션 `20260820120000_skin_tribe_and_drop_gacha`가 들어갔다(스킨 종족 전용 + 치장 종족 무관). `.env`에 `BEDROCK_VISION_MODEL_ID="us.amazon.nova-2-lite-v1:0"` 한 줄을 추가한다 — `.env.example`에 추가된 유일한 키다. `migrate dev`와 `migrate reset`은 실행하지 않는다. `migrate deploy`만 쓴다.

`feat/pet`에 마이그레이션이 하나 더 있다 — `20260821090000_pet_last_fed_at`(`User.lastFedAt` nullable 컬럼 추가. 배고픔 게이지용. C의 2026-08-21 작업). **실 DB에 적용 완료다**(옛 차단 24번 해소). 받는 쪽은 `migrate deploy`가 "적용할 것 없음"으로 끝나지만 `prisma generate`는 꼭 돌린다.

`develop`에 마이그레이션이 하나 더 들어왔다 — `20260820130000_post_gallery_type_all`(`Post.galleryType`을 `GalleryType` enum으로 바꿔 `ALL` 값을 허용한다. E의 `06982b4`). 그전에 받아둔 사람은 `migrate deploy`를 한 번 더 돌린다.

**BottomNav 수정**: "진단결과" 탭이 `/diagnosis`(문항 화면)를 가리키던 버그를 `/diagnosis/result`(결과 화면)로 고쳤다(2026-08-19, E)

**`npm run lint` 에러 12건 — B 11건, D 1건, A 0건 (`cb16959`에서 재확인)**: B는 `any` 8건(`lib/missions/*`·미션·업로드 라우트), `set-state-in-effect` 1건(`MissionDashboard.tsx:676`), 나머지 경고. D는 `PostDetailModal.tsx:54`의 같은 `set-state-in-effect`. 사이드바 수정으로 경고 1건이 늘었다 — `Sidebar.tsx:30`의 `getStageEmoji()`가 `stage`를 계산하고 쓰지 않는다(레벨이 올라도 이모지가 안 바뀐다는 뜻이다. B 확인 필요). A의 `app/page.tsx:37`은 `fetchMe().then()` 안으로 옮겨 해소했다. 남의 소유 파일이라 A는 고치지 않았다(`CLAUDE.md` 2절). 빌드는 통과하므로 Amplify 배포는 막히지 않는다

**미확정 — 팀 전체 결정 필요**:
- "결정 변경" 4번(Cognito Google 로그인만)이 `SPEC.md` 10절·`CLAUDE.md` 8절과 충돌한다. 사용자 확인 대기 중이며, 지금 Cognito는 이메일+비밀번호로 이미 구축돼 있다. 방향이 바뀌면 E가 재작업해야 한다
- "결정 변경" 5번(셀프 머지 금지, main은 PR로만)이 `CLAUDE.md` 4절·`업무분담.md`의 기존 셀프 머지 규칙과 충돌한다. 두 문서가 아직 안 바뀌었다. E는 이 규칙 변경을 인지하기 전에 공유 파일들을 `main`에 직접 push했다(과거 관행대로) — 팀 전체가 어느 쪽으로 갈지 정해야 한다

**남은 수동 단계**: Amplify Hosting ↔ GitHub 연동. GitHub App 설치는 브라우저 OAuth 동의가 필요해 계정 소유자가 직접 눌러야 한다. 절차는 `docs/dev/infra.md` 참고

**보안 재검토 필요**: RDS를 팀원 로컬 개발 편의를 위해 Publicly Accessible=true로 설정했다(포트 5432를 0.0.0.0/0에 개방, 강력한 마스터 비밀번호로만 방어). 발표 전에 팀 전체가 재검토할 것 — 상세 이유는 `docs/dev/infra.md` "결정한 것과 이유" 참고

**인증 방식 확정**: `httpOnly` 쿠키(`access_token`)다. `lib/auth.ts`가 `cookies()`를 읽고 로그인 라우트가 `setSessionCookie()`로 심는다. 클라이언트가 `Authorization` 헤더를 실을 일은 없다 — 레포 전체에 그 호출부는 0건이다.

GitHub 원격 — https://github.com/uchan04/AWS_project

## origin 브랜치 상태 (2026-08-20 재확인)

통합 지점은 **`develop`**이다. `main`은 `develop`에 전부 포함돼 있고(E가 `152dbae`로 되돌려 머지했다), Amplify는 `main`에서 빌드한다.

| 브랜치 | 최신 | `develop` 미반영 | 비고 |
|---|---|---|---|
| `origin/develop` | `773262d` (8/20) | — | 통합 지점. A·B·C·D·E 머지 완료 |
| `origin/main` | `f0a8634` (8/20) | 0 | `develop`에 포함됨. 다만 **`develop`이 `main`보다 129커밋 앞선다** — Amplify는 `main`에서 빌드하므로 배포 전에 `develop`을 `main`에 올려야 한다 |
| `origin/feat/pet` | (8/20) | 0 | `develop`과 동일. 치장 구매 API·배경 6종 확정 가격·`북극고양이` 개명이 들어갔다 |
| `origin/feat/missions` | `6495f37` (8/20) | 0 | `develop`에 머지 완료(`90b386f`). 차단 18번 해소 |
| `origin/feat/diagnosis` | `a098c61` (8/20) | 0 | `develop`과 동일 |
| `origin/feat/community` | (8/20) | 0 | `develop`에 머지 완료(`563ab15`) |
| ~~`origin/feat/infra`~~ | — | — | 원격에서 삭제됐다. E는 `main`·`develop`에 직접 push해 왔다 |

**머지할 때 주의**: 예측 충돌은 이 문서 하나다. 담당별 줄과 차단 항목만 살려 손으로 합친다. 8/20 머지 4회에서 코드 충돌은 0건이었다. 머지 뒤 `npx prisma migrate deploy && npx prisma generate`를 돌리고 `npm run build`로 확인한다. **`develop`에 `--force`를 쓰지 않는다**(차단 18번) — push가 거절되면 `git fetch origin` 후 자기 브랜치에서 `git merge origin/develop`으로 다시 합친다.

## 결정 변경 (2026-08-19)

1. **동물·색 교체.** 여우 = 건강·정서취약형(주황 `#E8956A`), 고양이 = 독립거주-저소득형(푸른 `#6A95C8`), 곰 = 가족동거형(녹색 `#7AAE82`). Figma 프로토타입 값으로 맞췄다(옛 `#F59E0B`/`#38BDF8`/`#34D399`는 종이색 배경에서 형광으로 떴다). 값은 `lib/types.ts`의 `TRIBE`와 `styles/tokens.css`의 `[data-tribe]` 두 곳에 있다 — 한쪽만 고치지 않는다
2. **관리자 세부유형 8개 추가.** 연구보고서 9유형에서 경계선지능청년 제외. 사용자에게는 여전히 동물 3종만 보인다
3. **아키네이터식 진단.** 문항 13개를 정의하고 유형이 확정되면 조기 종료한다. 무손실이며 실측 평균 9.7문항
4. **Cognito는 이메일+비밀번호와 Google을 함께 지원한다** (확정, 2026-08-20). `SPEC.md` 10절·`CLAUDE.md` 8절 갱신 완료. `lib/auth.ts`가 `Authorization` 헤더 대신 `access_token` httpOnly 쿠키를 읽도록 바뀌었다 — 헤더 방식은 문서 내비게이션(링크 클릭·주소창 이동)에 커스텀 헤더가 안 붙어서 서버 컴포넌트 페이지를 인증할 수 없었다(`feat/pet`·`feat/community`의 서버 컴포넌트 페이지 5개가 여기 해당). Google 로그인은 Cognito Domain(`welli-auth-185236887369`)까지 만들어졌고, Google Cloud Console에서 발급받은 OAuth Client ID/Secret을 Cognito Identity Provider로 연결하는 마지막 단계만 남았다 — 콜백 URL은 `https://welli-auth-185236887369.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`.
5. **브랜치 규칙.** 담당별 브랜치에 커밋하고 `main`은 PR로만 올린다. 셀프 머지 안 한다
6. **홈 화면 담당은 A**
7. **화면 디자인 기준은 루트 `design.md`, 토큰은 `styles/tokens.css`.** A가 만들었고 진단·결과·홈 3장에 적용했다. 다른 화면도 같은 결로 맞출 담당자는 이 두 파일을 본다. `app/globals.css`·`app/layout.tsx`(E 소유)는 건드리지 않았고 새 npm 의존성도 없다
8. **색·폰트 값의 출처는 Figma 프로토타입**(`isol-design_Figma/README.md` "디자인 규칙" 절). 배경 `#F5F0E8` / 카드 `#FDFBF5` / 주색 `#4B7A5B` / 강조 `#A9542A`, 제목 Gowun Dodum · 본문 Noto Sans KR. hex를 그대로 쓰고 OKLCH로 변환하지 않는다. 프로토타입의 6문항 진단·종족명·특성 설명·직접 `seeds` 증감은 가져오지 않는다(명세 위반)
9. **하단 탭을 없애고 사이드바 하나만 쓴다.** — **적용됨(2026-08-20)**. 다만 E가 아니라 B가 구현했다. 진단 화면 숨김도 `51b2897`로 붙었고 A의 `--nav-h` 되돌리기도 완료다. **모바일 좁은 레일만 아직 없다 — 차단 11번.** E가 "데스크톱=사이드바 / 모바일=하단 탭" 이원화를 제안했으나, 내비게이션 두 벌은 화면마다 어느 쪽이 뜨는지 확인해야 하고 활성 표시·경로가 두 곳에서 갈린다. 마감 3일 전에 감당할 비용이 아니다. 모바일은 같은 사이드바를 아이콘만 남긴 좁은 레일로 줄이고, 진단 문항 화면에서는 내비를 숨긴다. 적용은 E(`app/layout.tsx`), 적용 후 A가 `styles/tokens.css`의 `--nav-h`를 지운다
10. **미션 데이터의 원본은 DB다.** `prisma/seed/missions.ts`는 그 DB를 채우는 시드일 뿐이고, 화면에 41개 문구를 다시 복사하지 않는다. B가 `시드 → DB Mission → GET /api/missions → 화면`으로 간다. A의 홈 미션 미리보기는 그 API가 나오면 그쪽으로 바꾼다(지금은 시드 배열을 직접 읽는 임시 상태이며, `import type`뿐이라 클라이언트 번들에 Prisma는 들어가지 않는다 — 빌드 산출물로 확인)
11. **화면 구성도 Figma에서 가져왔다.** `#EDE5D0` 판 위의 카드(`.hm--canvas` + `.hm-card`), 화면별 폭(진단 680 · 결과·홈 840 · 시작 900px), 넓은 화면 2열 격자, 진행률 바, A·B·C 글자가 붙은 선택지, 결과 마스코트 등장(`bounceIn`), 시작 화면 좌우 분할. 진행률 바의 값은 총 문항 수가 아니라 "유형이 좁혀진 정도"다 — 조기 종료 때문에 총 문항 수를 노출할 수 없다(`SPEC.md` 3절). 통계 카드·출석 캘린더·경험치 바는 가져오지 않았다(데이터 없음. DB 공유 후 채운다)

## 결정 변경 (2026-08-20)

12. **스킨은 종족 전용 외형이다.** 진단으로 정해진 동물은 고정이고 상점에서 사는 것은 같은 동물의 변종뿐이다(여우 → 북극여우, 고양이 → **북극고양이**, 곰 → 북극곰). 능력치는 바뀌지 않고 외형만 바뀐다. 친밀도 전용 캐릭터 3종(늑대·삵·판다)과 고유 효과는 없어졌다. 고양잇과 변종은 `샴고양이`에서 `북극고양이`로 개명했다(2026-08-20, C) — 셋 다 "북극"으로 어휘를 맞췄다. `imageKeyBase`도 `pets/cat-arctic`이다
13. **화폐를 전용으로 갈랐다.** 스킨은 별조각 전용, 치장 아이템은 친밀도 전용이다. 가챠 컷으로 소모처를 잃었던 별조각이 스킨 상점을, 획득 경로가 없던 치장이 등급 가격을 얻었다. 가격은 같은 날 두 번 바뀌어 **최종값은 아래 17번**이다(스킨 2500 / 치장 COMMON 600). 폐기된 안: 최초(변종 50, 치장 50/100/200/400) → 중간(변종 300, 치장 60/100/180/280)
14. **치장 아이템은 종족 구분이 없다.** `CosmeticItem.tribeColor`를 지웠다. 컬러명(노을·새벽·이끼)은 더 이상 종족과 대응하지 않는다
15. **가챠를 스키마에서 지웠다.** `GachaPull` 테이블과 `User.heroPity`·`legendPity`를 삭제했다. `feat/pet`에 스키마 삭제분만 있고 마이그레이션이 없어 실 DB와 갈라져 있던 드리프트도 이번에 닫혔다
16. **치장은 배경 6종이다.** 12종(모자·목도리·배경 각 4개)에서 배경만 6종(`배경1`~`배경6`) 남겼다. 치장 이미지 12장을 8/22까지 만들 수 없고, 슬롯이 하나면 "슬롯당 1개"가 곧 "배경 하나 고르기"가 되어 화면도 단순해진다. 등급은 6종 전부 `COMMON`이다 — 서로 대체재인 배경에 가격 차이를 두면 유저가 얻는 정보가 없다. 가격은 아래 17번(각 600, 합계 3600). `Slot` enum은 그대로 둬서 마이그레이션이 없다

17. **재화 가격과 수급량을 확정했다.** 스킨 = **별조각 2500**, 배경 = **각 친밀도 600**(합 3600), **일일 미션 전체 완료 = 별조각 60**, 글 작성 = 친밀도 20 · 일 상한 100. 수급은 별조각 약 63.6/일(스킨 **39일**), 친밀도 최대 100/일(배경 하나 6일 · 전부 **36일**)로 두 상점 속도를 비슷하게 맞췄다. 실사용자가 없는 데모 프로젝트이므로 이 곡선은 시연 화면이 아니라 "설계가 성립하는가"를 보이는 값이고, 8/26 녹화는 데모 계정 시드로 찍는다. 씨앗은 3단 진화(1,050) 이후 소모처가 없고 그대로 둔다 — 스킨·치장이 둘 다 씨앗을 받지 않는다. 등급 표는 COMMON만 올리면 RARE가 더 싸지므로 전부 10배로 올렸다(600/1000/1800/2800). **별조각 60은 B의 `447957d`로 구현됐다** — 39일 수급이 실제로 성립한다
18. **친밀도 지급 지점은 커뮤니티·챗봇 한 곳이다.** 미션 보상(`prisma/seed/missions.ts`, A)과 커뮤니티 지급(`app/community/_lib/affinity.ts`, D)이 각각 20을 줘서 글 1개에 40이 들어갔다. **미션 시드 쪽을 0으로 내렸다**(2026-08-20, `5a2753e`). 미션 보상은 하루 한 번만 나가는데 두 번째 글·대화 턴에도 친밀도가 붙어야 하므로, 남길 쪽은 매번 도는 커뮤니티/챗봇이다. 확정값은 글 `POST_AFFINITY = 20` · 대화 턴 `CHAT_TURN_AFFINITY = 5` · 일 상한 100. `Mission.rewardAffinity`는 컬럼만 남고 값이 0인 상태다 — 나중에 친밀도를 주는 미션을 넣을 때 D의 지급과 겹치지 않는지 먼저 본다

**스키마 담당 규칙 예외.** `CLAUDE.md` 5절은 마이그레이션을 1인(E)만 실행하라고 한다. 이번에는 팀 합의 후 A가 `prisma/schema.prisma` 수정과 `migrate deploy`까지 실행했다. 마이그레이션은 `20260820120000_skin_tribe_and_drop_gacha` 하나뿐이고 히스토리는 갈라지지 않았다. **나머지 4인은 `git pull && npx prisma migrate deploy && npx prisma generate`만 실행한다.** 다음 스키마 변경은 다시 E가 맡는다

## 외부 피드백 검증 (2026-08-20)

팀원이 아닌 곳에서 인프라 점검 피드백 5건을 받아 코드·AWS·전체 브랜치를 직접 대조했다. 다시 확인하지 않아도 되도록 결과만 남긴다.

- 로그인 화면 없음(#2)·`amplify.yml` 없음(#5): 맞음 → 이번에 해결(위 참고)
- `Authorization: Bearer` 헤더로는 서버 컴포넌트를 인증할 수 없다는 지적(#1): 맞음. main에는 아직 영향 없지만 `feat/pet`·`feat/community`에 이미 서버 컴포넌트로 `getCurrentUser()`를 부르는 페이지 5개가 있어 머지 시점에 터질 문제였다 → 쿠키 방식으로 전환해 해결
- **`app/components/BottomNav.tsx`가 고아라는 지적(#3)은 틀렸다.** `app/layout.tsx`에서 실제로 import·렌더링 중이며 하단 탭 내비게이션 자체다. 문서의 "동결"은 "다른 담당자가 건드리지 말라"는 뜻이었다. **삭제하지 않았다.**
- `lib/missions/vision.ts`·`BEDROCK_VISION_MODEL_ID`(#4): main과 4개 feature 브랜치 어디에도 존재하지 않는다. 처리 대상 없음 — 작성자 로컬의 미푸시 코드로 보인다.

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
