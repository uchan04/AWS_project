# 진행 상황

**모든 세션은 이 문서부터 읽는다.** 그다음 아래 "지금 읽어야 할 문서"만 읽고 시작한다.

최종 갱신: 2026-08-20 (`develop` ↔ `feat/diagnosis` 머지. C·D·E는 이미 머지 완료)
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
| A | 진단 + 미션 콘텐츠 + 홈 | 미션 41개, 13문항 + 판정 함수, 조기 종료, 화면 3장 + Figma 값·구성 반영, 진단 API 3종(완료·조회·닉네임) + 화면 연결, **실 DB로 진단→결과→홈 전체 흐름 확인 완료** | A 담당 기능은 4단계(Bedrock)·관리자 교차표만 남았다. 홈의 펫·미션 실데이터는 B·C API 대기 |
| B | 미션 시스템 + 사진 업로드 | **착수했다** (2026-08-20 확인). `feat/missions`에 1단계 미션 대시보드 UI, 사진 모달 Figma 정렬, 사진 미션 검증 스펙 문서 | `main`에 아직 없다. `completeMission()`을 D가 기다리는 중 |
| C | 펫 + 스킨 | **`SPEC.md` 5절 기능 완료.** 성장·씨앗 투입·진화 연출, 방치형 자동 획득, 치장 착용·해제, 스킨 구매·전환 + 화면 3장. 스킨·치장 구조 변경(종족 전용 외형 / 치장 종족 무관 / 가챠 삭제)은 스키마·실 DB·시드·API·화면까지 반영 완료(2026-08-20, A) | 남은 것은 **치장 구매 라우트**(차단 9)와 `SPEC.md` 2·5·6·11절·`docs/dev/pet.md`·`docs/인수인계.md` 갱신, `scripts/check-pet.ts` 어미 단정 추가. 목록은 `docs/dev/diagnosis.md` 15절 |
| D | 커뮤니티 + 챗봇 | 기능 구현 끝. 챗봇 Bedrock 스트리밍 연결 완료(2026-08-19). 미션 완료 연동 호출부(`completeMission`)는 주석으로 준비만 해둠 | `completeMission()`(B) 대기 상태. 막힌 항목 5개와 주의사항은 `docs/dev/community.md` 상단 "재개 지점" 참고 |
| E | 인프라 + 인증 | RDS·Cognito·S3+CloudFront·CloudWatch+SNS·Bedrock·auth 실검증·하단 탭 내비 완료, PR #1 머지 + 2차 마이그레이션 + auth 빌드 수정 + 색 토큰 정리 완료 | Amplify GitHub 연동만 남음(브라우저 수동 단계) |

## 전체 차단 사항

지금 프로젝트를 멈춰 세우는 것만 적는다. 해결되면 즉시 지운다.

인프라 차단은 해소됐다(RDS·Cognito·S3·Bedrock 완료). `.env`의 `DATABASE_URL`·`COGNITO_*`·`S3_BUCKET`·`CLOUDFRONT_DOMAIN`·`BEDROCK_MODEL_ID`는 E에게 개별 공유받는다.

~~2. `SubTypeCode` 2차 마이그레이션~~ — 해소(2026-08-19), **2026-08-20 실 DB로 재확인**. E가 `7d86546`으로 `prisma/migrations/20260819080703_add_subtype/`을 `main`에 올렸고, RDS `_prisma_migrations`에 `20260819061857_init`(08-19 06:19)·`20260819080703_add_subtype`(08-19 08:07) 두 행이 `finished_at`까지 찍혀 있다. `npx prisma migrate status` = "Database schema is up to date", `User.subTypeCode`·`DiagnosisSession.subTypeCode`·`indicators` 컬럼 실재 확인. **나머지 4인은 `git pull && npx prisma migrate deploy && npx prisma generate`**
~~3. `lib/auth.ts` 빈 Pool ID로 빌드 깨짐~~ — 해소(2026-08-19). `CognitoJwtVerifier.create()`를 `getCurrentUser()` 안으로 지연 생성하도록 수정. `.env`에 더미 값 우회 넣었던 사람은 지워도 된다
~~5. 종족 색 이중 정의~~ — 해소(2026-08-19). `app/globals.css`의 `--color-canine/feline/ursine` 세 줄 삭제. 이제 `styles/tokens.css`·`lib/types.ts`(A)가 유일한 출처

~~4. `feat/community`에 중복 init 마이그레이션~~ — 해소(2026-08-20 확인). D가 `ff6c492`에서 `origin/main`을 머지해 `00000000000000_init/`을 폐기했다. 이제 `origin/feat/community`의 `prisma/migrations/`는 `main`과 동일한 2개(`20260819061857_init`·`20260819080703_add_subtype`)다

~~1. 공유 DB에 옛 동물 매핑이 이미 들어가 있다~~ — 해소(2026-08-20, A). 실 DB를 다시 읽어 보니 확정 매핑과 새 이름(노을·새벽·이끼)이 이미 들어가 있었고 `main`의 시드 *파일*만 옛 값이었다. 스킨·치장 구조 변경과 함께 시드를 확정 값으로 맞췄고, 유저 `밤바다`는 `typeCode=INDEPENDENT_LOW_INCOME` / 활성 펫 **고양이**로 이미 일치해 손댈 것이 없었다. 상세는 `docs/dev/diagnosis.md` 15절

~~6. 가챠 삭제 결정에 따른 스키마 드리프트~~ — 해소(2026-08-20, A). `20260820120000_skin_tribe_and_drop_gacha` 마이그레이션이 `GachaPull` 테이블과 `User.heroPity`·`legendPity`를 실 DB에서 DROP했다. `prisma migrate diff --exit-code`로 드리프트 없음 확인

~~7. `npm run db:seed`가 실패한다~~ — 재현되지 않는다(2026-08-20 확인). `npm run db:seed`가 `.env`를 읽고 그대로 통과한다(`스킨 6종, 치장 12종 반영 / 미션 41개 반영 / seed 완료`). `tsx` 4.x가 `.env`를 자동으로 읽는다. `package.json`은 그대로 둔다

~~8. 치장 획득 경로와 별조각 소모처가 없다~~ — **경로는 정해졌다**(2026-08-20 팀 결정). 치장은 친밀도 전용 상점에서 등급 가격으로 산다(COMMON 50 / RARE 100 / EPIC 200 / LEGENDARY 400). 별조각은 종족 변종 스킨 상점(변종 50)이 소모처다. 결정 변경 13번 참고. **구현은 스킨 쪽만 끝났다** — 아래 9번

남은 것은 아래 2개다.

4. **클라이언트가 `Authorization` 헤더를 싣지 않는다 (E 담당, D가 보고)** — `lib/auth.ts` 서버 검증은 완료됐지만 화면에서 토큰을 실어 보내지 않는다. 이대로 배포하면 전 API가 401이다. 로그인 화면·토큰 보관 방식이 E 담당이고 방식 확정 대기
9. **치장 구매 라우트가 없다 (C 담당)** — 가격은 시드·DB에 다 들어갔고 `GET /api/pet/cosmetics`가 `priceAffinity`를 내려주지만 `POST /api/pet/cosmetics/buy`가 없다. 그래서 치장 화면은 여전히 전부 "미획득"으로 보인다. 스킨 쪽(`POST /api/pet/skins/buy`)은 별조각 결제로 고쳐 두었으니 그 파일을 그대로 베끼면 된다 — 친밀도 차감, 종족 검사 없음, `affinityOnly && priceAffinity !== null`만 확인

**8/20 5인 머지 진행 중.** C·D·E는 `develop`에 머지 완료. A의 `feat/diagnosis`는 `develop`(`d8edf2b`)을 받아 충돌 3건(`prisma/schema.prisma`·`prisma/seed/items.ts`·`docs/STATUS.md`)을 해결하고 빌드를 확인했다. 남은 것은 B(`feat/missions`)다.

**BottomNav 수정**: "진단결과" 탭이 `/diagnosis`(문항 화면)를 가리키던 버그를 `/diagnosis/result`(결과 화면)로 고쳤다(2026-08-19, E)

**`npm run lint` 에러 — A 것은 고쳤고 D 것이 1건 남았다 (2026-08-20)**: `app/page.tsx:37`의 `setGreeting(...)`은 `fetchMe().then()` 안으로 옮겨 해소했다(A). 남은 에러는 `app/community/_components/PostDetailModal.tsx:54`의 `setLoading(true)`로 같은 `react-hooks/set-state-in-effect`다 — D 소유 파일이라 A는 고치지 않았다(`CLAUDE.md` 2절). 빌드는 통과하므로 Amplify 배포는 막히지 않는다. 경고 2건(`_request` 미사용, D)도 남아 있다

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
| `origin/develop` | `d8edf2b` (8/20) | — | 통합 지점. C·D·E 머지 완료 |
| `origin/main` | `12ff359` (8/19) | 0 | A(진단)·E(인프라)만. `develop` 안정화 후 한 번에 올린다 |
| `origin/feat/pet` | `82b692a` (8/19) | 0 | `develop`에 머지됨 |
| `origin/feat/community` | `460679b` (8/20) | 0 | `develop`에 머지됨. 중복 init 폐기됨(차단 4 해소) |
| `origin/feat/diagnosis` | `203462e` (8/20) | 6커밋 | 이 브랜치에서 `develop`을 머지해 충돌 3건 해결 중 |
| `origin/feat/missions` | `f1cc8d5` (8/20) | 5커밋 | **아직 `develop`에 없다.** 남은 마지막 머지 |
| `origin/feat/infra` | `a7dece8` (8/17) | 0 | E는 `main`·`develop`에 직접 push해 왔다. 이 브랜치는 낡았다 |

**머지 순서 주의**: `docs/STATUS.md`는 5인이 전부 고치므로 머지할 때마다 충돌한다. 담당별 줄과 차단 항목만 살려 손으로 합친다. 코드 파일은 폴더가 갈려 충돌하지 않지만, **`prisma/schema.prisma`와 `prisma/seed/items.ts`는 8/20 스킨·치장 구조 변경 때문에 충돌한다 — 전부 `develop` 쪽(구조 변경 반영분)을 채택한다.**

## 결정 변경 (2026-08-19)

1. **동물·색 교체.** 여우 = 건강·정서취약형(주황 `#E8956A`), 고양이 = 독립거주-저소득형(푸른 `#6A95C8`), 곰 = 가족동거형(녹색 `#7AAE82`). Figma 프로토타입 값으로 맞췄다(옛 `#F59E0B`/`#38BDF8`/`#34D399`는 종이색 배경에서 형광으로 떴다). 값은 `lib/types.ts`의 `TRIBE`와 `styles/tokens.css`의 `[data-tribe]` 두 곳에 있다 — 한쪽만 고치지 않는다
2. **관리자 세부유형 8개 추가.** 연구보고서 9유형에서 경계선지능청년 제외. 사용자에게는 여전히 동물 3종만 보인다
3. **아키네이터식 진단.** 문항 13개를 정의하고 유형이 확정되면 조기 종료한다. 무손실이며 실측 평균 9.7문항
4. **Cognito는 Google 로그인만.** `SPEC.md` 10절("소셜 로그인은 쓰지 않는다")·`CLAUDE.md` 8절과 충돌한다. 두 문서 갱신은 사용자 확인 대기
5. **브랜치 규칙.** 담당별 브랜치에 커밋하고 `main`은 PR로만 올린다. 셀프 머지 안 한다
6. **홈 화면 담당은 A**
7. **화면 디자인 기준은 루트 `design.md`, 토큰은 `styles/tokens.css`.** A가 만들었고 진단·결과·홈 3장에 적용했다. 다른 화면도 같은 결로 맞출 담당자는 이 두 파일을 본다. `app/globals.css`·`app/layout.tsx`(E 소유)는 건드리지 않았고 새 npm 의존성도 없다
8. **색·폰트 값의 출처는 Figma 프로토타입**(`isol-design_Figma/README.md` "디자인 규칙" 절). 배경 `#F5F0E8` / 카드 `#FDFBF5` / 주색 `#4B7A5B` / 강조 `#A9542A`, 제목 Gowun Dodum · 본문 Noto Sans KR. hex를 그대로 쓰고 OKLCH로 변환하지 않는다. 프로토타입의 6문항 진단·종족명·특성 설명·직접 `seeds` 증감은 가져오지 않는다(명세 위반)
9. **하단 탭을 없애고 사이드바 하나만 쓴다.** E가 "데스크톱=사이드바 / 모바일=하단 탭" 이원화를 제안했으나, 내비게이션 두 벌은 화면마다 어느 쪽이 뜨는지 확인해야 하고 활성 표시·경로가 두 곳에서 갈린다. 마감 3일 전에 감당할 비용이 아니다. 모바일은 같은 사이드바를 아이콘만 남긴 좁은 레일로 줄이고, 진단 문항 화면에서는 내비를 숨긴다. 적용은 E(`app/layout.tsx`), 적용 후 A가 `styles/tokens.css`의 `--nav-h`를 지운다
10. **미션 데이터의 원본은 DB다.** `prisma/seed/missions.ts`는 그 DB를 채우는 시드일 뿐이고, 화면에 41개 문구를 다시 복사하지 않는다. B가 `시드 → DB Mission → GET /api/missions → 화면`으로 간다. A의 홈 미션 미리보기는 그 API가 나오면 그쪽으로 바꾼다(지금은 시드 배열을 직접 읽는 임시 상태이며, `import type`뿐이라 클라이언트 번들에 Prisma는 들어가지 않는다 — 빌드 산출물로 확인)
11. **화면 구성도 Figma에서 가져왔다.** `#EDE5D0` 판 위의 카드(`.hm--canvas` + `.hm-card`), 화면별 폭(진단 680 · 결과·홈 840 · 시작 900px), 넓은 화면 2열 격자, 진행률 바, A·B·C 글자가 붙은 선택지, 결과 마스코트 등장(`bounceIn`), 시작 화면 좌우 분할. 진행률 바의 값은 총 문항 수가 아니라 "유형이 좁혀진 정도"다 — 조기 종료 때문에 총 문항 수를 노출할 수 없다(`SPEC.md` 3절). 통계 카드·출석 캘린더·경험치 바는 가져오지 않았다(데이터 없음. DB 공유 후 채운다)

## 결정 변경 (2026-08-20)

12. **스킨은 종족 전용 외형이다.** 진단으로 정해진 동물은 고정이고 상점에서 사는 것은 같은 동물의 변종뿐이다(여우 → 북극여우, 고양이 → 샴고양이, 곰 → 북극곰). 능력치는 바뀌지 않고 외형만 바뀐다. 친밀도 전용 캐릭터 3종(늑대·삵·판다)과 고유 효과는 없어졌다
13. **화폐를 전용으로 갈랐다.** 스킨은 별조각 전용(변종 50), 치장 아이템은 친밀도 전용이다. 치장 가격은 등급에서 파생시킨다(COMMON 50 / RARE 100 / EPIC 200 / LEGENDARY 400, 12종 합 1,850). 가챠 컷으로 소모처를 잃었던 별조각이 스킨 상점을, 획득 경로가 없던 치장 9종이 등급 가격을 얻었다
14. **치장 아이템은 종족 구분이 없다.** `CosmeticItem.tribeColor`를 지웠다. 컬러명(노을·새벽·이끼)은 더 이상 종족과 대응하지 않는다
15. **가챠를 스키마에서 지웠다.** `GachaPull` 테이블과 `User.heroPity`·`legendPity`를 삭제했다. `feat/pet`에 스키마 삭제분만 있고 마이그레이션이 없어 실 DB와 갈라져 있던 드리프트도 이번에 닫혔다

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
