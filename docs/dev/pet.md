# 펫 개발 문서 (담당 C)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 5·6절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: `lib/reward.ts` 골격 + 자체 체크, `SPEC.md` 6절/`CLAUDE.md` 대조 검증
- 완료: 펫 성장 계산 + 체크 37개, 펫 화면, 씨앗 투입 API, 진화 연출
- 완료: 시드 종족·컬러를 A의 새 매핑으로 정렬 (`origin/main` 차단 사항 1번 해소)
- 미착수: 방치형 획득, 치장 착용, 친밀도 캐릭터 구매
- 가챠는 코드에서 제거했고 나중에 재구현한다 (아래 절 참고). 컷 아님

**아직 런타임 검증은 못 했다.** 확인한 것은 빌드 통과, `check:pet` 37개·`check:reward`·`check:diagnosis` 통과, `lint` 통과, `/pet`이 200으로 뜨는 것까지다. 씨앗 투입·레벨업·진화 연출이 실제로 도는지는 `.env` 값을 E에게 받은 뒤 확인해야 한다.

## 오늘 진행 요약 (2026-08-19)

`feat/pet`에 푸시한 커밋 11개. 앞의 8개는 이전 작업분이고 오늘 추가한 것은 아래 3개다.

| 커밋 | 내용 |
|---|---|
| `22d30fa` | 치장 9종 이름·`imageKey`를 새 컬러 팔레트로 교체 |
| `78d305b` | D 마이그레이션 폐기 확정 + 컬러명 변경 문서화 |
| `6be6151` | 씨앗→경험치 비율 1:1 → 1:10 |

**A의 반영 지시 2건 처리 결과**

1. 펫 3종 매핑(여우 → `HEALTH_EMOTION`, 고양이 → `INDEPENDENT_LOW_INCOME`) — `6fecded`에서 **이미 반영돼 있었다.** A가 본 것은 그 이전 상태였다
2. 치장 "라벤더" 3종 이름 — 맞는 지적이지만 **범위가 3종이 아니라 9종이었다.** A의 `58f86f2`에서 세 컬러 전부 바뀌어 앰버·세이지도 존재하지 않는 색이 됐다. 9종 전부 바꿨다

`origin/main`의 `SPEC.md` 2절·`lib/types.ts` `TRIBE`와 대조해 값이 일치하는 것을 확인했다:

| TypeCode | 과/동물 | 컬러 | 치장 |
|---|---|---|---|
| `HEALTH_EMOTION` | 개과/여우 | 노을 주황 `#E8956A` | 노을 모자·목도리·배경 |
| `INDEPENDENT_LOW_INCOME` | 고양잇과/고양이 | 새벽 파랑 `#6A95C8` | 새벽 모자·목도리·배경 |
| `FAMILY_LIVING` | 곰과/곰 | 이끼 초록 `#7AAE82` | 이끼 모자·목도리·배경 |

밤별 3종(친밀도 전용)은 3컬러 밖의 별도 색이라 유지했다. `imageKey`도 `amber|lavender|sage` → `sunset|dawn|moss`로 맞췄다 — 이미지가 미제작이라 지금이 바꿀 수 있는 마지막 시점이었다.

## 구현한 파일
- `lib/reward.ts` — `calculateReward(skin, base)`, `capAffinity()`
- `scripts/check-reward.ts` — `npm run check:reward`. 로직을 고쳤으면 반드시 돌린다
- `prisma/seed/items.ts` — 펫·캐릭터 6종, 치장 12종
- `lib/pet.ts` — `applySeeds()`, `cappedStage()`, `expProgress()`. 순수 함수만 둔다
- `scripts/check-pet.ts` — `npm run check:pet`. 성장 곡선·진화 임계값·다중 레벨업 검증
- `app/pet/page.tsx` — 서버 컴포넌트. `force-dynamic`
- `app/pet/_components/PetView.tsx` — 경험치 바, 씨앗 투입 버튼, 진화 풀스크린 연출 2초
- `app/api/pet/route.ts` — GET 초기 상태
- `app/api/pet/feed/route.ts` — POST 씨앗 투입

## 결정한 것과 이유
- `calculateReward`는 `User`가 아니라 `PetSkin | null`을 받는다. `User`만 받으면 함수가 async가 되어 호출부 4명이 전부 바뀐다
- 성장: **씨앗 1 = exp 10**, 필요 exp = 레벨 × 100, 5레벨 2단 / 15레벨 3단
- **씨앗→경험치 비율을 1:1 → 1:10으로 변경 (2026-08-19).** 배율은 `lib/pet.ts`가 아니라 `lib/types.ts`의 `SEED_TO_EXP`에 있다(A 소유 공유 파일). `applySeeds()`는 상수를 참조만 하므로 `lib/pet.ts`는 손대지 않았다. A 브랜치가 그 줄을 건드리지 않은 것을 `git diff`로 확인한 뒤 사용자 승인을 받아 `main`에서 고쳤다 — **A에게 통보 필요**. 소비자는 `lib/pet.ts` 하나뿐이라 다른 담당 코드에는 영향이 없다
  - 밸런스: 1→2 레벨업 씨앗 10개, 3단 진화(15레벨)까지 누적 1,050개 (이전 10,500개)
  - `SPEC.md` 5절도 같이 갱신했다 (5절은 C 담당 절)
  - `scripts/check-pet.ts`는 값만 바꾸면 의도가 깨지는 케이스가 있어 씨앗 수를 다시 잡았다. "레벨업 직전"과 "소수점 버림"은 레벨업이 없는 구간이어야 의미가 있어 99→9, 10.9→9.9로 바꿨다. 비율을 또 바꾸면 이 두 개를 먼저 확인한다
  - 비율 자체를 못 박는 `assert.equal(SEED_TO_EXP, 10)`을 추가했다. 상수가 조용히 바뀌면 여기서 먼저 걸린다
- 캐릭터는 유형 제한 없이 3종 모두 구매 가능
- **씨앗 투입은 `calculateReward()`를 통과하지 않는다.** 저 함수는 재화를 *획득*할 때 배율을 얹는다. 투입은 쓰는 쪽이라 배율을 얹으면 10개를 넣었는데 11개가 빠진다. `SPEC.md` 6절의 통과 대상 목록(미션·방치형·출석·친밀도)에도 투입은 없다. `CLAUDE.md` 2절 위반처럼 보이므로 라우트에 이유를 주석으로 남겼다
- 성장 계산을 `lib/pet.ts` 순수 함수로 뺐다. DB·요청 객체를 모르게 유지해야 `check:pet`으로 검증할 수 있다
- 씨앗 차감과 성장 반영은 한 트랜잭션이고, 트랜잭션 안에서 잔액을 다시 읽는다. 버튼 연타로 두 요청이 겹치면 잔액보다 많이 빠질 수 있다
- 레벨 여러 개가 한 번에 오를 수 있어 `while`로 처리한다 (씨앗을 몰아 넣는 경우). `level`이 0 이하로 들어오면 필요 exp가 0이 되어 무한 루프가 되므로 1로 클램프한다
- GET 응답의 `evolutionStage`는 저장값이 아니라 레벨에서 다시 계산한다. 미션 보상이 씨앗만 올리고 단계를 갱신하지 않는 경우에 화면이 어긋나지 않게 한다
- `app/pet/page.tsx`에 `force-dynamic`을 넣었다. 없으면 빌드 시점에 DB 미연결 안내가 정적으로 굳어 DB가 붙은 뒤에도 그대로 나온다

## 막힌 것 / 문제점 (2026-08-19 갱신)

`origin/main`을 다시 읽고 갱신했다. 인프라 차단은 해소됐고, 대신 통합 쪽 문제가 3건 생겼다.

**1. 가챠 스키마 드리프트 — 머지 전 팀 결정 필요 (가장 중요)**

`origin/main`의 `schema.prisma`와 RDS에 **이미 적용된** `20260819061857_init` 마이그레이션에는 `GachaPull` 테이블·`User.heroPity`·`User.legendPity`가 살아 있다. C가 `7b0bcd0`에서 스키마에서 지운 것들이다. 내 작업을 머지하면 스키마에는 없고 실제 DB에는 있는 상태가 되어 다음 `migrate dev`가 DROP 마이그레이션을 만든다. 가챠는 나중에 재구현할 거라 테이블을 지금 지울 이유가 없다. 선택지:

1. 스키마 제거분을 머지하지 않고 `GachaPull`을 되살린다 (테이블은 두고 코드만 안 쓴다). 추가 마이그레이션 없음
2. 제거분을 머지하고 DROP 마이그레이션을 만든다. 재구현 때 다시 CREATE

`prisma/schema.prisma`는 전원 합의 파일이라 C 단독으로 못 정한다.

**2. `SEED_TO_EXP` 변경이 A 소유 파일에 있다**

`lib/types.ts:63`을 `1` → `10`으로 고쳤다. `origin/main`은 아직 `1`이고, A가 그 줄을 건드리지 않아 **auto-merge 된다**(`git merge-tree`로 확인). 충돌은 없지만 A가 모르는 변경이라 통보가 필요하다.

**3. 셀프 머지 금지 규칙과 `CLAUDE.md`가 충돌한다**

`origin/main`의 "결정 변경" 5번은 `main`을 PR로만 올리라고 하는데 `CLAUDE.md` 4절·`업무분담.md`는 셀프 머지를 지시한다. 두 문서가 아직 안 바뀌었다. **그래서 `main`에 직접 푸시하지 않고 `feat/pet`만 푸시했다** — 어느 규칙을 따라도 안전한 쪽이다. PR을 열지 여부는 팀 결정 대기.

**해소된 것 (이전 세션에 막힌 것으로 적어 뒀던 것들)**
- ~~DB 없음~~ — RDS·Cognito·S3·Bedrock 완료(E). `.env` 값은 E에게 개별로 받는다. **받으면 씨앗 투입·레벨업·진화 연출을 실제로 돌려봐야 한다**
- ~~디자인 토큰 없음~~ — `styles/tokens.css`와 루트 `design.md`가 `main`에 있다. 펫 화면은 Tailwind 기본 클래스로만 짜 뒀으니 이 토큰과 `design.md` 결에 맞춰 다시 손봐야 한다
- ~~하단 탭 없음~~ — E가 BottomNav를 넣었다. `/pet` 탭 경로가 맞는지 확인 필요
- ~~시드 매핑 옛 값~~ — `22d30fa`에서 해소(`origin/main` 차단 사항 1번)

**남아 있는 것**
- 펫·치장 이미지 미제작. `imageKey`는 `prisma/seed/items.ts`에 고정해 뒀다. 이미지가 나오면 `PetView.tsx`의 `ANIMAL_EMOJI`를 `<img>`로 교체한다
- 치장 획득 경로 미정. 가챠를 걷어내면서 경로가 사라졌고 별조각도 소모처가 없다 (`SPEC.md` 5절에 팀 논의 필요로 적혀 있다)
- `npm run db:seed`는 아직 아무도 돌리지 않았다. 시드를 고친 지금은 돌려도 안전하지만, `upsert`가 `name` 기준이라 **이름을 또 바꿀 일이 있으면 시드 전에 끝내야 한다**

## 가챠 — 제거 완료, 나중에 재구현 (`7b0bcd0`)

컷이 아니다. 우선순위를 뒤로 미뤄 코드에서 걷어냈고, 펫 화면·방치형·치장을 끝낸 뒤 다시 넣는다. 되살릴 때 필요한 것:

- `prisma/schema.prisma` — `GachaPull` 모델, `User.heroPity`/`legendPity`, `CosmeticItem.pulls`
- `lib/reward.ts` — `DUPLICATE_REFUND`(일반 2 / 희귀 5 / 영웅 20 / 전설 50)
- `SPEC.md` 5절 — 확률(전설 0.6 / 영웅 9.4 / 희귀 40 / 일반 50), 천장(영웅 10, 전설 80), 중복 환급
- 중복 획득 시 환급 처리가 없으면 `UserCosmetic` 유니크 제약 때문에 500이 난다. 재구현 때 이것부터 넣는다

`git show 7b0bcd0` 로 제거한 내용 전체를 되돌려 볼 수 있다. `docs/인수인계.md`는 가챠 서술을 그대로 남겨 뒀다.

**주의**: D가 `feat/community`에 올린 마이그레이션(`18640a7`)에는 `GachaPull` 테이블과 `heroPity`·`legendPity` 컬럼이 아직 들어 있다. 8/19에 **폐기 확정**했다 — 실행 절차와 D가 로컬에서 할 일은 `docs/STATUS.md` "D 마이그레이션 폐기" 절에 있다. 가챠를 재구현할 때도 그 마이그레이션을 되살리는 게 아니라 스키마부터 다시 넣고 새 마이그레이션을 만든다.

## TypeCode ↔ 종족 매핑 + 컬러명 변경 (`6fecded`, 컬러명은 후속 커밋)

A의 `feat/diagnosis`에서 매핑이 맞바뀌었고 8/19 팀 확인으로 의도된 변경이다.
컬러 이름·hex는 A의 `58f86f2`(Figma 팔레트)에서 세 계열 전부 바뀌었다.

| TypeCode | 과 | 동물 | 컬러 | 이전 컬러명 |
|---|---|---|---|---|
| `HEALTH_EMOTION` | 개과 | 여우 | 노을 주황 `#E8956A` | 앰버 오렌지 `#F59E0B` |
| `INDEPENDENT_LOW_INCOME` | 고양잇과 | 고양이 | 새벽 파랑 `#6A95C8` | 라벤더 퍼플 `#A78BFA` |
| `FAMILY_LIVING` | 곰과 | 곰 | 이끼 초록 `#7AAE82` | 세이지 그린 `#84A98C` |

출처는 A의 `lib/types.ts` `TRIBE`와 `styles/tokens.css` `[data-tribe]`이고 둘이 일치한다.
`prisma/seed/items.ts`는 매핑·치장 이름·`imageKey`를 이 표로 맞춰 놨다.

- 치장 9종 이름: 앰버/라벤더/세이지 → 노을/새벽/이끼. `imageKey`도 `amber|lavender|sage` → `sunset|dawn|moss`로 바꿨다 (이미지가 아직 없어 지금이 바꿀 수 있는 마지막 시점이다)
- 밤별 3종은 3컬러 밖의 별도 색이라 그대로 둔다
- **`upsert`가 `name`을 유니크 키로 쓴다.** 시드를 한 번 돌린 뒤 이름을 바꾸면 옛 이름 행이 남고 새 행이 추가된다. 이름 변경은 첫 `npm run db:seed` 전에 끝내야 한다. 아직 아무도 시드를 돌리지 않았으므로 지금 상태는 안전하다

**정합성 확인 완료 (2026-08-19):** A가 PR #1로 머지되어 `origin/main`의 `lib/types.ts` `TRIBE`와 `SPEC.md` 2절 표가 모두 위 새 값으로 갱신됐다. `styles/tokens.css`의 `[data-tribe]` hex도 일치한다. `prisma/seed/items.ts`가 이 세 곳과 어긋나지 않는 것을 확인했다.

펫 화면에서 종족·컬러를 표시할 때는 `lib/types.ts`를 쓴다. `TRIBE`에 `emoji` 필드가 추가돼 `PetView.tsx`의 `ANIMAL_EMOJI`와 중복된다 — 다음 작업 때 `TRIBE.emoji`로 합친다. 단 `ANIMAL_EMOJI`에는 친밀도 캐릭터(늑대·삵·판다)가 있고 `TRIBE.emoji`에는 기본 3종만 있어 그대로 대체하면 안 된다.

## 검증한 것
- `lib/reward.ts`를 `SPEC.md` 6절, `CLAUDE.md` 1절과 한 줄씩 대조함
  - `calculateReward(skin: PetSkin | null, base: RewardInput)` 시그니처 일치
  - `effectPct`는 정수(15 = +15%)로 스키마 주석과 코드가 일치
  - `capAffinity`/`AFFINITY_DAILY_CAP=100`이 SPEC 5절 수치와 일치
  - 결론: `lib/reward.ts` 자체는 빠진 것 없음
- 확인 안 된 것(다른 담당 영역): 미션·커뮤니티·챗봇 라우트가 `user.seeds += n` 없이 `calculateReward()`를 통과하는지는 그 라우트들이 미착수라 검증 불가. B·D가 착수하면 재확인

## 다음 할 일

순서대로 한다. 위 두 개는 남은 기능보다 먼저다 — 통합이 막히면 기능을 더 만들어도 못 올린다.

1. **가챠 스키마 드리프트 결정을 받는다** ("막힌 것" 1번). 전원 합의 파일이라 C 단독으로 못 정한다
2. **`.env` 값을 E에게 받아 런타임 검증** — 씨앗 투입 → 레벨업 → 진화 연출을 실제로 한 번 돌린다. 지금까지 순수 함수 체크와 빌드만 통과한 상태다
3. `origin/main`을 `feat/pet`에 머지하고 빌드 확인. `docs/STATUS.md`는 충돌하므로 `origin/main` 버전을 취한다
4. 펫 화면을 `styles/tokens.css`·`design.md` 결에 맞춘다. 지금은 Tailwind 기본 클래스뿐이라 다른 화면과 톤이 다르다
5. 방치형 자동 획득 (`lastIdleClaimAt` 시간차, 상한 12시간분). 획득이므로 `calculateReward()`를 통과한다
6. 치장 착용·해제 (슬롯당 1개), 목록에 수집 진행률 `12/30`
7. 친밀도 전용 캐릭터 3종 구매·전환 (각 300 친밀도)
8. 가챠 재구현은 위 항목이 전부 끝난 뒤. 치장 획득 경로 결정이 선행 조건이다
