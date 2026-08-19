# 펫 개발 문서 (담당 C)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 5·6절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: `lib/reward.ts` 골격 + 자체 체크, `SPEC.md` 6절/`CLAUDE.md` 대조 검증
- 완료: 펫 성장 계산 + 체크 24개, 펫 화면, 씨앗 투입 API, 진화 연출
- 미착수: 방치형 획득, 치장 착용, 친밀도 캐릭터 구매
- 가챠는 코드에서 제거했고 나중에 재구현한다 (아래 절 참고). 컷 아님

**DB가 없어 런타임 검증은 못 했다.** 확인한 것은 빌드 통과, `check:pet`·`check:reward` 통과, `/pet`이 200으로 뜨고 DB 미연결 안내가 나오는 것까지다. 씨앗 투입·레벨업·진화 연출이 실제로 도는지는 `DATABASE_URL`이 생긴 뒤 다시 확인해야 한다.

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
- 성장: 씨앗 1 = exp 1, 필요 exp = 레벨 × 100, 5레벨 2단 / 15레벨 3단
- 캐릭터는 유형 제한 없이 3종 모두 구매 가능
- **씨앗 투입은 `calculateReward()`를 통과하지 않는다.** 저 함수는 재화를 *획득*할 때 배율을 얹는다. 투입은 쓰는 쪽이라 배율을 얹으면 10개를 넣었는데 11개가 빠진다. `SPEC.md` 6절의 통과 대상 목록(미션·방치형·출석·친밀도)에도 투입은 없다. `CLAUDE.md` 2절 위반처럼 보이므로 라우트에 이유를 주석으로 남겼다
- 성장 계산을 `lib/pet.ts` 순수 함수로 뺐다. DB·요청 객체를 모르게 유지해야 `check:pet`으로 검증할 수 있다
- 씨앗 차감과 성장 반영은 한 트랜잭션이고, 트랜잭션 안에서 잔액을 다시 읽는다. 버튼 연타로 두 요청이 겹치면 잔액보다 많이 빠질 수 있다
- 레벨 여러 개가 한 번에 오를 수 있어 `while`로 처리한다 (씨앗을 몰아 넣는 경우). `level`이 0 이하로 들어오면 필요 exp가 0이 되어 무한 루프가 되므로 1로 클램프한다
- GET 응답의 `evolutionStage`는 저장값이 아니라 레벨에서 다시 계산한다. 미션 보상이 씨앗만 올리고 단계를 갱신하지 않는 경우에 화면이 어긋나지 않게 한다
- `app/pet/page.tsx`에 `force-dynamic`을 넣었다. 없으면 빌드 시점에 DB 미연결 안내가 정적으로 굳어 DB가 붙은 뒤에도 그대로 나온다

## 막힌 것
- 펫·치장 이미지 미제작. `imageKey`는 `prisma/seed/items.ts`에 미리 고정해 뒀다. 화면에서는 동물 이모지를 단계별 크기로 대체해 뒀으니 이미지가 나오면 `PetView.tsx`의 `ANIMAL_EMOJI`를 `<img>`로 교체한다
- **DB 없음 (E 담당)** — 씨앗 투입·레벨업·진화 연출의 런타임 검증이 전부 여기서 막혀 있다
- 디자인 토큰 없음 — `app/globals.css`가 기본값이고 E 소유라 손대지 않았다. 펫 화면은 Tailwind 기본 클래스로만 짰다. A가 `feat/diagnosis`에 `styles/tokens.css`를 만들어 뒀으니 E가 전역 스타일을 동결할 때 맞춰야 한다
- 하단 탭 내비게이션이 없어 `/pet`으로 직접 들어가야 한다 (`app/layout.tsx`는 E 소유)

## 가챠 — 제거 완료, 나중에 재구현 (`7b0bcd0`)

컷이 아니다. 우선순위를 뒤로 미뤄 코드에서 걷어냈고, 펫 화면·방치형·치장을 끝낸 뒤 다시 넣는다. 되살릴 때 필요한 것:

- `prisma/schema.prisma` — `GachaPull` 모델, `User.heroPity`/`legendPity`, `CosmeticItem.pulls`
- `lib/reward.ts` — `DUPLICATE_REFUND`(일반 2 / 희귀 5 / 영웅 20 / 전설 50)
- `SPEC.md` 5절 — 확률(전설 0.6 / 영웅 9.4 / 희귀 40 / 일반 50), 천장(영웅 10, 전설 80), 중복 환급
- 중복 획득 시 환급 처리가 없으면 `UserCosmetic` 유니크 제약 때문에 500이 난다. 재구현 때 이것부터 넣는다

`git show 7b0bcd0` 로 제거한 내용 전체를 되돌려 볼 수 있다. `docs/인수인계.md`는 가챠 서술을 그대로 남겨 뒀다.

**주의**: D가 `feat/community`에 올린 마이그레이션에는 `GachaPull`·`heroPity`가 아직 들어 있다. 그 마이그레이션은 폐기 대상이다 (`docs/STATUS.md` "통합 시 주의" 참고).

## TypeCode ↔ 종족 매핑 변경 (`6fecded`)

A의 `feat/diagnosis`에서 매핑이 맞바뀌었고 8/19 팀 확인으로 의도된 변경이다.

| TypeCode | 과 | 동물 | 컬러 |
|---|---|---|---|
| `HEALTH_EMOTION` | 개과 | 여우 | 앰버 오렌지 |
| `INDEPENDENT_LOW_INCOME` | 고양잇과 | 고양이 | 라벤더 퍼플 |
| `FAMILY_LIVING` | 곰과 | 곰 | 세이지 그린 |

`prisma/seed/items.ts`는 이 새 매핑으로 맞춰 놨다. **`main`의 `SPEC.md` 2절 표와 `lib/types.ts`는 아직 옛 매핑이라 A 브랜치가 머지되기 전까지 서로 어긋난다.** 펫 화면에서 종족·컬러를 표시할 때는 `lib/types.ts`를 쓰되, A 머지 후 값이 뒤바뀌지 않는지 반드시 다시 확인한다.

## 검증한 것
- `lib/reward.ts`를 `SPEC.md` 6절, `CLAUDE.md` 1절과 한 줄씩 대조함
  - `calculateReward(skin: PetSkin | null, base: RewardInput)` 시그니처 일치
  - `effectPct`는 정수(15 = +15%)로 스키마 주석과 코드가 일치
  - `capAffinity`/`AFFINITY_DAILY_CAP=100`이 SPEC 5절 수치와 일치
  - 결론: `lib/reward.ts` 자체는 빠진 것 없음
- 확인 안 된 것(다른 담당 영역): 미션·커뮤니티·챗봇 라우트가 `user.seeds += n` 없이 `calculateReward()`를 통과하는지는 그 라우트들이 미착수라 검증 불가. B·D가 착수하면 재확인

## 다음 할 일
- 방치형 자동 획득 (`lastIdleClaimAt` 시간차, 상한 12시간분). 획득이므로 `calculateReward()`를 통과한다
- 치장 착용·해제 (슬롯당 1개), 목록에 수집 진행률 `12/30`
- 친밀도 전용 캐릭터 3종 구매·전환 (각 300 친밀도)
- `DATABASE_URL`이 생기면 씨앗 투입 → 레벨업 → 진화 연출을 실제로 한 번 돌려본다
- 가챠 재구현은 위 항목이 전부 끝난 뒤
