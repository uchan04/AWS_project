-- PetSkin.avatarKey 추가 (2026-08-24, 사용자 결정)
--
-- 프로필 원형(사이드바·내 계정 모달)에만 쓰는 아바타 키다. 값은 Figma 시안 파일명
-- 그대로이고 `/images/`와 `.png`는 lib/assets.ts의 avatarUrl()이 붙인다.
--
-- 손으로 쓴 마이그레이션이다(`prisma migrate dev`를 돌리지 않았다 — CLAUDE.md 5절대로
-- 그건 스키마 담당 1인만 실행하고, 공유 DB에 히스토리를 갈라 놓지 않기 위해서다).
-- 받는 쪽은 `npx prisma migrate deploy && npx prisma generate`만 실행한다.
--
-- 되돌릴 수 있는 변경이다: 컬럼은 nullable이고 기본값 제약도 없다. 값이 null이면
-- 호출부가 imageKeyBase 쪽 그림으로 되돌아가므로, 이 마이그레이션 전 코드도 그대로 돈다.

ALTER TABLE "PetSkin" ADD COLUMN "avatarKey" TEXT;

-- 값도 여기서 채운다. 시드(prisma/seed/items.ts)에도 같은 값이 있지만, 시드 재실행은
-- PetSkin 말고도 미션 카탈로그·치장까지 upsert하므로 이 한 컬럼 때문에 돌릴 것이 아니다.
-- 여기 넣어 두면 팀원 4명과 프로덕션이 `migrate deploy` 한 번으로 같은 값을 갖는다.
--
-- 아바타는 종족당 1장이다. 북극 변종은 대체 그림이 없어 같은 종족 아바타를 쓴다.
UPDATE "PetSkin" SET "avatarKey" = 'fox_avatar'  WHERE "name" IN ('여우', '북극여우');
UPDATE "PetSkin" SET "avatarKey" = 'cat_avatar'  WHERE "name" IN ('고양이', '북극고양이');
UPDATE "PetSkin" SET "avatarKey" = 'bear_avatar' WHERE "name" IN ('곰', '북극곰');
