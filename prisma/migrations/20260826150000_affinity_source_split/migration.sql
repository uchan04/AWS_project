-- 친밀도 소스별 일일 상한 분리 (2026-08-26, D 요청)
--
-- 배경: 친밀도 일일 상한을 챗봇 40 / 커뮤니티 60으로 분리한다. 기존 User.affinityToday는
-- 소스 구분이 없는 단일 컬럼이라 컬럼을 나눈다. affinityToday/affinityTodayDate/
-- AFFINITY_DAILY_CAP(100)은 그대로 두고, 새 컬럼은 app/community/_lib/affinity.ts에서만
-- 읽고 쓴다.
--
-- 날짜 마커를 affinityTodayDate와 별도로 두는 이유: lib/missions/completion.ts,
-- attendance.ts가 grantAffinity()를 거치지 않고 affinityToday/affinityTodayDate를 직접
-- 갱신한다. 새 컬럼을 기존 마커에 묶으면 미션 경로가 먼저 실행된 날 새 컬럼만 리셋을
-- 건너뛰어 전날 값이 남는다.

ALTER TABLE "User" ADD COLUMN "affinityTodayChat" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "affinityTodayCommunity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "affinitySourceDate" TIMESTAMP(3);
