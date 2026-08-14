# 펫·가챠 개발 문서 (담당 C)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 5·6절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: `lib/reward.ts` 골격 + 자체 체크
- 진행 중: 없음
- 미착수: 펫 화면·진화, 방치형 획득, 가챠·천장, 치장 착용, 친밀도 캐릭터 구매

## 구현한 파일
- `lib/reward.ts` — `calculateReward(skin, base)`, `capAffinity()`, `DUPLICATE_REFUND`
- `scripts/check-reward.ts` — `npm run check:reward`. 로직을 고쳤으면 반드시 돌린다
- `prisma/seed/items.ts` — 펫·캐릭터 6종, 치장 12종

## 결정한 것과 이유
- `calculateReward`는 `User`가 아니라 `PetSkin | null`을 받는다. `User`만 받으면 함수가 async가 되어 호출부 4명이 전부 바뀐다
- 성장: 씨앗 1 = exp 1, 필요 exp = 레벨 × 100, 5레벨 2단 / 15레벨 3단
- 가챠 중복은 별조각 환급(일반 2 / 희귀 5 / 영웅 20 / 전설 50). 환급이 없으면 유니크 제약 때문에 500 에러
- 캐릭터는 유형 제한 없이 3종 모두 구매 가능

## 막힌 것
- 펫·치장 이미지 미제작. `imageKey`는 `prisma/seed/items.ts`에 미리 고정해 뒀다

## 다음 할 일
- 가챠 확률·천장 로직 + 1만 회 시뮬레이션으로 분포 확인
