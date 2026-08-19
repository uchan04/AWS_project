# 펫·가챠 개발 문서 (담당 C)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 5·6절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: `lib/reward.ts` 골격 + 자체 체크, `SPEC.md` 6절/`CLAUDE.md` 대조 검증
- 진행 중: 없음
- 미착수: 펫 화면·진화, 방치형 획득, 치장 착용, 친밀도 캐릭터 구매
- **가챠 = 보류 (2026-08-19). 컷이 아니라 "나중에 구현"이다.** 우선순위를 뒤로 미뤘을 뿐 범위에서 빠지지 않았다. 펫 화면·방치형·치장을 먼저 끝내고 여유가 생기면 착수한다

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

## 커밋하지 않은 작업 트리 변경 (2026-08-19 시점)

가챠를 **제거하는** 방향의 수정이 작업 트리에 남아 있으나 **커밋하지 않았다.** 가챠는 나중에 구현하기로 했으므로 이 변경은 보류 상태다. 다음 세션에서 판단해서 되돌리거나(`git checkout -- <파일>`) 확정한다.

- `prisma/schema.prisma` — `GachaPull` 모델, `User.heroPity`/`legendPity`, `CosmeticItem.pulls` 삭제
- `lib/reward.ts` — `DUPLICATE_REFUND` 상수 삭제
- `prisma/seed/items.ts` — `GACHA_COSMETICS` → `SHOP_COSMETICS` 이름 변경
- `SPEC.md` 5절, `업무분담.md`, `docs/STATUS.md` — 가챠 절 삭제·"컷" 표기

**가챠를 되살리려면 위 4개 파일을 되돌리면 된다.** `docs/인수인계.md`는 이미 원래대로(가챠 포함) 되돌려 놨다.

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
- 가챠는 위 항목이 끝난 뒤에 착수 (보류 중)
