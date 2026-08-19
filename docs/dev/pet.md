# 펫 개발 문서 (담당 C)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 5·6절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: `lib/reward.ts` 골격 + 자체 체크, `SPEC.md` 6절/`CLAUDE.md` 대조 검증
- 진행 중: 펫 화면 (`feat/pet`)
- 미착수: 방치형 획득, 치장 착용, 친밀도 캐릭터 구매
- 가챠는 코드에서 제거했고 나중에 재구현한다 (아래 절 참고). 컷 아님

## 구현한 파일
- `lib/reward.ts` — `calculateReward(skin, base)`, `capAffinity()`
- `scripts/check-reward.ts` — `npm run check:reward`. 로직을 고쳤으면 반드시 돌린다
- `prisma/seed/items.ts` — 펫·캐릭터 6종, 치장 12종

## 결정한 것과 이유
- `calculateReward`는 `User`가 아니라 `PetSkin | null`을 받는다. `User`만 받으면 함수가 async가 되어 호출부 4명이 전부 바뀐다
- 성장: 씨앗 1 = exp 1, 필요 exp = 레벨 × 100, 5레벨 2단 / 15레벨 3단
- 캐릭터는 유형 제한 없이 3종 모두 구매 가능

## 막힌 것
- 펫·치장 이미지 미제작. `imageKey`는 `prisma/seed/items.ts`에 미리 고정해 뒀다

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
- 펫 화면(레벨·경험치·진화 연출)부터 착수 — DB 없이도 `DEV_AUTH_BYPASS`로 화면 작업 가능
- 그다음 방치형 자동 획득 → 치장 착용 → 친밀도 캐릭터 구매
- 가챠 재구현은 위 항목이 전부 끝난 뒤
