-- 배고픔 게이지 (SPEC.md 5절). 마지막 급여 시각만 저장하고 배고픔 값은 계산한다.
-- nullable 컬럼 추가라 기존 행에 손대지 않는다. null인 유저는 화면이 createdAt을 기준으로 쓴다.
--
-- 이 파일은 손으로 썼다. `prisma migrate dev`는 스키마 담당 1인만 실행한다(CLAUDE.md 5절).
-- 받는 쪽은 `npx prisma migrate deploy && npx prisma generate`만 실행한다.
ALTER TABLE "User" ADD COLUMN "lastFedAt" TIMESTAMP(3);
