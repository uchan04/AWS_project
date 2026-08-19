# 진행 상황

**모든 세션은 이 문서부터 읽는다.** 그다음 아래 "지금 읽어야 할 문서"만 읽고 시작한다.

최종 갱신: 2026-08-19
현재 단계: **D1 — 인프라 착수 (8/14 목표가 8/15로 하루 지연)**

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
| A | 진단 + 미션 콘텐츠 | 진단·결과·홈 화면, 디자인 토큰, 적응형 진단까지 진행 | **`feat/diagnosis`에 미머지 15커밋.** `schema.prisma`·`lib/types.ts` 변경 포함 |
| B | 미션 시스템 + 사진 업로드 | 미착수 | 일일 미션 5개로 선행 개발 가능 |
| C | 펫 | `lib/reward.ts` 골격 완료. 가챠 제거 반영 | 가챠는 나중에 재구현 예정(컷 아님). 치장 획득 경로·별조각 소모처 미정 |
| D | 커뮤니티 + 챗봇 | 챗봇 UI·API, 커뮤니티 글쓰기·댓글·좋아요 구현 | **`feat/community`에 미머지 16커밋.** 포함된 마이그레이션 1개는 폐기 확정 (아래 절) |
| E | 인프라 + 인증 | 프로젝트 생성·스키마·auth 스텁 완료 | RDS·Amplify·Cognito 남음 |

**미머지 브랜치 경고 (2026-08-19 확인)** — A 15커밋 / D 16커밋이 `main`에 머지되지 않았고 둘 다 `main`보다 5커밋 뒤처져 있다. CLAUDE.md 4절은 하루 1회 머지다. 통합 순서와 주의점은 아래 "통합 시 주의" 참고.

## 통합 시 주의 (2026-08-19)

1. **`TypeCode` 동물 매핑이 A 브랜치에서 맞바뀌었다 (의도된 변경, 8/19 확인)** — `INDEPENDENT_LOW_INCOME`이 고양잇과/고양이, `HEALTH_EMOTION`이 개과/여우다. 컬러 이름·hex도 A의 `58f86f2`에서 세 계열 전부 바뀌었다(앰버→노을 주황 / 라벤더→새벽 파랑 / 세이지→이끼 초록). `main`의 `lib/types.ts`와 **A 브랜치를 포함한 양쪽 `SPEC.md` 2절 표**가 아직 옛 값이다 — A가 머지할 때 갱신한다. 이 enum을 값으로 쓰는 코드는 전부 재확인이 필요하다. `prisma/seed/items.ts`의 펫 매핑·치장 이름·`imageKey`는 C가 새 값으로 맞춰 놨다
2. **D의 `prisma/migrations/00000000000000_init/`은 폐기 확정 (2026-08-19 결정)** — 아래 "D 마이그레이션 폐기" 절 참고
3. `docs/STATUS.md`를 A·C·D가 각자 고쳤다. 머지 시 3방향 충돌을 예상하고 이 파일은 손으로 합친다

## D 마이그레이션 폐기 (2026-08-19 결정)

`origin/feat/community`의 `prisma/migrations/00000000000000_init/migration.sql`(313줄, 커밋 `18640a7`, D가 로컬 DB용으로 손수 만든 베이스라인)을 **공유 이력으로 쓰지 않는다.**

**근거 — 현재 `schema.prisma`와 이미 어긋나 있다:**
- 테이블 `GachaPull`이 남아 있다. `7b0bcd0`에서 스키마에서 제거했다
- `User.heroPity` / `User.legendPity` 컬럼이 남아 있다. 같은 커밋에서 제거했다
- A의 `SubTypeCode`·`indicators`가 빠져 있다 (`main` 시점 스키마로 만들어졌다)

**실행 상태:** `main`에는 `prisma/migrations/`가 아예 없으므로 지금 `main`에서 지울 것은 없다. 이 파일은 `feat/community` 머지 시점에 들어오려 하므로, 그때 커밋에 포함시키지 않고 드롭한다.

```bash
# feat/community 머지 시 (머지 담당이 실행)
git merge feat/community          # 이 파일이 추가됨
git rm -r --cached prisma/migrations/00000000000000_init
rm -rf prisma/migrations/00000000000000_init
```

원본은 `18640a7`에 영구 보존되므로 필요하면 `git show 18640a7` 로 언제든 되돌려 본다.

**D가 로컬에서 해야 할 것:** D의 로컬 DB `_prisma_migrations` 테이블에 이 마이그레이션이 적용됨으로 기록돼 있다. 파일이 사라지면 다음 `prisma migrate` 실행이 "폴더에 없는 마이그레이션" 오류를 낸다. **로컬** DB에서 해당 행을 지우거나, 초기화가 필요하면 CLAUDE.md 5절대로 **팀에 먼저 알린 뒤** 로컬에서만 초기화한다. 공유 RDS에는 `migrate reset`을 절대 쓰지 않는다.

**진짜 init은 누가 만드나:** CLAUDE.md 5절대로 스키마 담당 1인(E)이 A·C·D 스키마를 모두 합친 뒤 `npx prisma migrate dev`를 **한 번만** 실행해 생성한다. 그 전까지 `main`에는 마이그레이션이 없으므로 `npm run db:push`(= `prisma migrate deploy`)로 적용할 이력이 없다.

## 전체 차단 사항

지금 프로젝트를 멈춰 세우는 것만 적는다. 해결되면 즉시 지운다.

1. **RDS 없음** — `DATABASE_URL`이 비어 있어 `prisma migrate dev`를 아직 실행하지 못했다. `main`에 `prisma/migrations/`가 없고, D가 만든 것은 폐기 확정이라 쓰지 않는다. E 담당. A·B·C·D의 화면·API가 전부 여기서 막혀 있다. 시드(`npm run db:seed`)도 아직 아무도 돌리지 않았다
2. **`lib/auth.ts`가 스텁** — `DEV_AUTH_BYPASS=true`로만 동작한다. 실제 Cognito 검증 필요. E 담당

GitHub 원격은 해결됐다 — https://github.com/uchan04/AWS_project

## 마일스톤

| 날짜 | 목표 | 상태 |
|---|---|---|
| 8/14 | 레포·프로젝트·브랜치, auth 스텁, schema 초안 | 완료 — 브랜치 5개는 원격에 모두 있다(8/19 `git fetch`로 확인). 이 줄이 "미생성"으로 남아 있어 한 번 오판했다 |
| 8/15 | RDS + 마이그레이션 + `DATABASE_URL` 공유, 첫 라이브 배포 | 진행 중 |
| 8/16 | schema 확정, 미션 41개, Cognito | 미션 41개 완료. schema·Cognito 남음 |
| 8/16 | 기능 5개 병렬 착수, 하루 2회 통합 시작 | |
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
