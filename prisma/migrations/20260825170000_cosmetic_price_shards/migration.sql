-- 치장(배경) 상점을 친밀도 → 별조각으로 전환 (2026-08-25, C. 사용자 결정).
-- 근거와 가격 계산은 docs/dev/pet.md "상점 별조각 전환", SPEC.md 5절.
--
-- 이 파일도 손으로 썼다. `prisma migrate dev`는 스키마 담당 1인만 실행한다(CLAUDE.md 5절).
-- 받는 쪽은 `npx prisma migrate deploy && npx prisma generate`만 실행한다.
--
-- **기존 표에 컬럼을 추가한다.** 앞선 20260825120000_pet_outing이 신규 표만 만든 것과
-- 다르므로 위험을 적어 둔다: 이 마이그레이션이 적용되지 않은 DB에 새 코드가 붙으면
-- CosmeticItem을 읽는 SELECT가 P2022로 죽는다(8/24 develop 전면 500의 그 오류다).
-- 다만 죽는 범위는 /pet/cosmetics 한 화면이고, 그 화면과 라우트는 try/catch로
-- 안내 카드를 띄운다. /pet 홈은 CosmeticItem에서 name·slot·imageKey만 읽어 영향이 없다.
--
-- 되돌리기: 코드를 revert하고 `npm run db:seed`를 다시 돌린다. priceAffinity를 지우지
-- 않았으므로 옛 가격(600)이 DB에 그대로 남아 있다. 컬럼 drop은 필요 없다 —
-- priceShards가 남아 있어도 옛 코드는 그 값을 읽지 않는다.

ALTER TABLE "CosmeticItem" ADD COLUMN "priceShards" INTEGER;

-- 등급별 새 가격. 이 CASE는 prisma/seed/items.ts의 PRICE_BY_RARITY와 같은 표여야 한다.
-- 시드를 돌리면 어차피 덮어써지지만, 시드 실행 전에도 상점이 정상 동작해야 한다 —
-- 값이 null인 행은 화면에서 "미획득"(비매품)으로 보이므로 살 수 없는 상점이 된다.
--
-- priceAffinity가 null인 행은 건너뛴다. 지금 6행은 전부 값이 있지만, 나중에 비매품이
-- 생겼을 때 이 마이그레이션을 다시 읽는 사람이 "비매품에도 값을 박았다"고 오해하지 않게
-- 판매 여부를 옮기는 조건을 명시한다.
UPDATE "CosmeticItem"
SET "priceShards" = CASE "rarity"
  WHEN 'COMMON' THEN 500
  WHEN 'RARE' THEN 1000
  WHEN 'EPIC' THEN 1800
  WHEN 'LEGENDARY' THEN 2800
END
WHERE "priceAffinity" IS NOT NULL;
