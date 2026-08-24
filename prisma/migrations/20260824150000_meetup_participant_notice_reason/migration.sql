-- 무산 알림 읽음 시각 + 신청 취소 사유.
-- 이 파일은 손으로 썼다. `prisma migrate dev`는 스키마 담당 1인만 실행한다(CLAUDE.md 5절).
-- 받는 쪽은 `npx prisma migrate deploy && npx prisma generate`만 실행한다.
--
-- 둘 다 nullable이라 기존 행에 손대지 않는다.
-- cancelReason은 선택 입력이므로 null이 비정상 상태가 아니다.

ALTER TABLE "MeetupParticipant" ADD COLUMN "notifiedCancelAt" TIMESTAMP(3);
ALTER TABLE "MeetupParticipant" ADD COLUMN "cancelReason" TEXT;
