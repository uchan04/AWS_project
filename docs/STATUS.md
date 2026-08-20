# 진행 상황

**모든 세션은 이 문서부터 읽는다.** 그다음 아래 "지금 읽어야 할 문서"만 읽고 시작한다.

최종 갱신: 2026-08-19
현재 단계: **D2 — 인프라 완료, 기능 5개 병렬 착수 (8/19 중간 체크포인트)**

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
| A | 진단 + 미션 콘텐츠 + 홈 | 미션 41개, 13문항 + 판정 함수, 조기 종료, 화면 3장 + Figma 값·구성 반영, 진단 API 3종(완료·조회·닉네임) + 화면 연결 완료 | 2차 마이그레이션 완료, API 정상 동작. 홈 실데이터는 B·C API 대기 |
| B | 미션 시스템 + 사진 업로드 | 미착수 | `DATABASE_URL`·S3 버킷 확보됨, 착수 가능 |
| C | 펫 + 가챠 | `lib/reward.ts` 골격 완료 | 착수 가능. `prisma/seed/items.ts` 동물 매핑 수정이 먼저 (차단 1) |
| D | 커뮤니티 + 챗봇 | 구현 중 (`feat/community`에 커뮤니티·챗봇 대량 커밋) | 브랜치에 중복 init 마이그레이션 있음 (차단 4) |
| E | 인프라 + 인증 | RDS·Cognito·S3+CloudFront·CloudWatch+SNS·Bedrock·auth 실검증·하단 탭 내비 완료, PR #1 머지 + 2차 마이그레이션 + auth 빌드 수정 + 색 토큰 정리 완료. 로그인 화면(이메일+비밀번호/Google) + 쿠키 기반 인증 전환 + `amplify.yml` 완료(2026-08-20) | Amplify GitHub 연동, Google IdP 자격증명(아래 참고) 남음 |

## 전체 차단 사항

지금 프로젝트를 멈춰 세우는 것만 적는다. 해결되면 즉시 지운다.

인프라 차단은 해소됐다(RDS·Cognito·S3·Bedrock 완료). `.env`의 `DATABASE_URL`·`COGNITO_*`·`S3_BUCKET`·`CLOUDFRONT_DOMAIN`·`BEDROCK_MODEL_ID`는 E에게 개별 공유받는다.

~~2. `SubTypeCode` 2차 마이그레이션~~ — 해소(2026-08-19). `migrate dev --name add_subtype` 실행 완료. **나머지 4인은 `git pull && npx prisma migrate deploy && npx prisma generate`**
~~3. `lib/auth.ts` 빈 Pool ID로 빌드 깨짐~~ — 해소(2026-08-19). `CognitoJwtVerifier.create()`를 `getCurrentUser()` 안으로 지연 생성하도록 수정. `.env`에 더미 값 우회 넣었던 사람은 지워도 된다
~~5. 종족 색 이중 정의~~ — 해소(2026-08-19). `app/globals.css`의 `--color-canine/feline/ursine` 세 줄 삭제. 이제 `styles/tokens.css`·`lib/types.ts`(A)가 유일한 출처

남은 것은 아래 2개다.

1. **`prisma/seed/items.ts` 동물 매핑이 옛 값** — 여우↔고양이가 뒤바뀌었고 치장 "라벤더" 3종 이름이 색과 안 맞는다. **`npm run db:seed`보다 먼저 고쳐야 한다.** 안 고치면 뒤바뀐 매핑이 DB에 들어간다. C 담당 파일이라 다른 사람이 못 고친다
4. **`feat/community`에 중복 init 마이그레이션** — D 브랜치에 `prisma/migrations/00000000000000_init/`이 있고 `main`에는 `20260819061857_init/`·`20260819080703_add_subtype/`이 있다. 머지하면 init이 두 개가 되어 `migrate deploy`가 깨진다(`CLAUDE.md` 5절). D가 자기 브랜치의 `prisma/migrations/`를 지우고 main 것을 받아야 한다

**BottomNav 수정**: "진단결과" 탭이 `/diagnosis`(문항 화면)를 가리키던 버그를 `/diagnosis/result`(결과 화면)로 고쳤다(2026-08-19, E)

**미확정 — 팀 전체 결정 필요**:
- "결정 변경" 4번(Cognito Google 로그인만)이 `SPEC.md` 10절·`CLAUDE.md` 8절과 충돌한다. 사용자 확인 대기 중이며, 지금 Cognito는 이메일+비밀번호로 이미 구축돼 있다. 방향이 바뀌면 E가 재작업해야 한다
- "결정 변경" 5번(셀프 머지 금지, main은 PR로만)이 `CLAUDE.md` 4절·`업무분담.md`의 기존 셀프 머지 규칙과 충돌한다. 두 문서가 아직 안 바뀌었다. E는 이 규칙 변경을 인지하기 전에 공유 파일들을 `main`에 직접 push했다(과거 관행대로) — 팀 전체가 어느 쪽으로 갈지 정해야 한다

**남은 수동 단계**: Amplify Hosting ↔ GitHub 연동. GitHub App 설치는 브라우저 OAuth 동의가 필요해 계정 소유자가 직접 눌러야 한다. 절차는 `docs/dev/infra.md` 참고

**보안 재검토 필요**: RDS를 팀원 로컬 개발 편의를 위해 Publicly Accessible=true로 설정했다(포트 5432를 0.0.0.0/0에 개방, 강력한 마스터 비밀번호로만 방어). 발표 전에 팀 전체가 재검토할 것 — 상세 이유는 `docs/dev/infra.md` "결정한 것과 이유" 참고

GitHub 원격 — https://github.com/uchan04/AWS_project

## 결정 변경 (2026-08-19)

1. **동물·색 교체.** 여우 = 건강·정서취약형(주황 `#E8956A`), 고양이 = 독립거주-저소득형(푸른 `#6A95C8`), 곰 = 가족동거형(녹색 `#7AAE82`). Figma 프로토타입 값으로 맞췄다(옛 `#F59E0B`/`#38BDF8`/`#34D399`는 종이색 배경에서 형광으로 떴다). 값은 `lib/types.ts`의 `TRIBE`와 `styles/tokens.css`의 `[data-tribe]` 두 곳에 있다 — 한쪽만 고치지 않는다
2. **관리자 세부유형 8개 추가.** 연구보고서 9유형에서 경계선지능청년 제외. 사용자에게는 여전히 동물 3종만 보인다
3. **아키네이터식 진단.** 문항 13개를 정의하고 유형이 확정되면 조기 종료한다. 무손실이며 실측 평균 9.7문항
4. **Cognito는 이메일+비밀번호와 Google을 함께 지원한다** (확정, 2026-08-20). `SPEC.md` 10절·`CLAUDE.md` 8절 갱신 완료. `lib/auth.ts`가 `Authorization` 헤더 대신 `access_token` httpOnly 쿠키를 읽도록 바뀌었다 — 헤더 방식은 문서 내비게이션(링크 클릭·주소창 이동)에 커스텀 헤더가 안 붙어서 서버 컴포넌트 페이지를 인증할 수 없었다(`feat/pet`·`feat/community`의 서버 컴포넌트 페이지 5개가 여기 해당). Google 로그인은 Cognito Domain(`welli-auth-185236887369`)까지 만들어졌고, Google Cloud Console에서 발급받은 OAuth Client ID/Secret을 Cognito Identity Provider로 연결하는 마지막 단계만 남았다 — 콜백 URL은 `https://welli-auth-185236887369.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`.
5. **브랜치 규칙.** 담당별 브랜치에 커밋하고 `main`은 PR로만 올린다. 셀프 머지 안 한다
6. **홈 화면 담당은 A**
7. **화면 디자인 기준은 루트 `design.md`, 토큰은 `styles/tokens.css`.** A가 만들었고 진단·결과·홈 3장에 적용했다. 다른 화면도 같은 결로 맞출 담당자는 이 두 파일을 본다. `app/globals.css`·`app/layout.tsx`(E 소유)는 건드리지 않았고 새 npm 의존성도 없다
8. **색·폰트 값의 출처는 Figma 프로토타입**(`isol-design_Figma/README.md` "디자인 규칙" 절). 배경 `#F5F0E8` / 카드 `#FDFBF5` / 주색 `#4B7A5B` / 강조 `#A9542A`, 제목 Gowun Dodum · 본문 Noto Sans KR. hex를 그대로 쓰고 OKLCH로 변환하지 않는다. 프로토타입의 6문항 진단·종족명·특성 설명·직접 `seeds` 증감은 가져오지 않는다(명세 위반)
9. **화면 구성도 Figma에서 가져왔다.** `#EDE5D0` 판 위의 카드(`.hm--canvas` + `.hm-card`), 화면별 폭(진단 680 · 결과·홈 840 · 시작 900px), 넓은 화면 2열 격자, 진행률 바, A·B·C 글자가 붙은 선택지, 결과 마스코트 등장(`bounceIn`), 시작 화면 좌우 분할. 진행률 바의 값은 총 문항 수가 아니라 "유형이 좁혀진 정도"다 — 조기 종료 때문에 총 문항 수를 노출할 수 없다(`SPEC.md` 3절). 통계 카드·출석 캘린더·경험치 바는 가져오지 않았다(데이터 없음. DB 공유 후 채운다)

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
| 8/19 | 중간 체크포인트 (컷 판단) | |
| 8/20 | 기능 동결, 발표 자료 착수 | |
| 8/22 | 개발 마감 | |
| 8/26 | 녹화 | |
| 8/28 | 발표 | |

---

## 갱신 규칙

- 하루 2회 통합할 때마다 "담당별 상태"와 "전체 차단 사항"을 갱신한다
- 단계가 넘어가면 "현재 단계"와 "지금 읽어야 할 문서"를 갱신한다
- 세부 내용은 여기에 쓰지 않는다. 담당 기능의 세부는 `docs/dev/<기능>.md`에 쓴다
- 갱신은 `docs:` 커밋으로 남긴다
