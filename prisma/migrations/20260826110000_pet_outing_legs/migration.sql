-- PetOuting.legs 추가 (2026-08-26, A. 여행일기 5축 전환)
--
-- 배경: 여행일기가 장소 1곳 × 만난것 1개에서 **장소 2~3곳 × (사건+결과+만난것)**으로 바뀌었다.
-- 단일 문자열 3개(placeKey/metKey/moodKey)로는 담을 수 없다.
--
--   legs = [{ "place": "park", "deed": "dash", "result": 0, "sight": "cat" }, ...]
--
-- 문장이 아니라 **키만** 담는다 — 문장을 저장하면 나중에 문구를 다듬을 때 옛 기록이 옛
-- 문장으로 굳는다(PET_IDLE_LINES를 상수로 둔 것과 같은 판단).
--
-- **되돌릴 수 있는 변경이다.** nullable이고 기존 3컬럼을 지우지 않았다. 이유는 둘이다.
--   1. 이 마이그레이션을 아직 안 받은 팀원의 DB에서도 코드가 돌아야 한다 — legs가 없으면
--      Prisma가 컬럼을 못 찾아 죽는 것이 아니라, 코드가 옛 3컬럼으로 되돌아간다
--   2. 이미 쌓인 옛 기록(placeKey='window' 등)이 계속 렌더돼야 한다
-- 옛 컬럼 드롭은 전원이 받은 뒤 별도 마이그레이션으로 한다.
--
-- 손으로 쓴 마이그레이션이다(`prisma migrate dev`를 돌리지 않았다 — CLAUDE.md 5절).
-- 받는 쪽은 `npx prisma migrate deploy && npx prisma generate`만 실행한다.

ALTER TABLE "PetOuting" ADD COLUMN "legs" JSONB;
