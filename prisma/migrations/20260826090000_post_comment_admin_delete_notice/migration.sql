-- Post·Comment 관리자 삭제 통보 (2026-08-26, D 요청 · E 승인, 안 A)
--
-- 배경: 욕설 필터를 계속 조여도 우회가 끝이 없어 사후 조치(관리자 삭제)를 방어선으로
-- 둔다. 삭제 자체는 스키마 없이 된다(User.isAdmin·deletedAt이 이미 있다) — 문제는
-- 통보다. deletedAt만으로는 본인 삭제와 관리자 삭제를 구분할 수 없고(본인이 지운
-- 글까지 팝업이 뜨면 안 된다), 삭제 시점에 접속 중이 아닐 수 있어 다음 접속 때
-- 띄워야 한다.
--
-- 안 A(최소 변경)를 택했다 — 안 B(Notification 모델 신설)는 조회·읽음 처리·정리까지
-- 범위가 커진다. 같은 문제(재접속 시 못 본 알림을 보여준다)를 MeetupParticipant가
-- 이미 notifiedCancelAt 한 필드로 풀어 놨다(20260824150000_meetup_participant_notice_reason) —
-- 그 결과 하나만 새로 두는 것이 아니라 새 모델 없이 문제를 닫는 선례가 됐다.
--
-- 조회 조건: deletedByAdmin = true AND deleteNotifiedAt IS NULL 인 것을 찾아 팝업을
-- 띄우고, 그 순간 deleteNotifiedAt을 찍는다. 본인 삭제는 deletedByAdmin이 계속
-- false이므로 이 조건에 걸리지 않는다.
--
-- 손으로 쓴 마이그레이션이다(`prisma migrate dev`를 돌리지 않았다 — CLAUDE.md 5절).
-- 받는 쪽은 `npx prisma migrate deploy && npx prisma generate`만 실행한다.
-- 되돌릴 수 있는 변경이다 — 두 컬럼 모두 기존 행에 기본값 false·null로 채워지고
-- 지금 있는 어떤 조회·삭제 경로도 이 컬럼을 아직 읽지 않는다.

ALTER TABLE "Post" ADD COLUMN "deletedByAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "deleteNotifiedAt" TIMESTAMP(3);

ALTER TABLE "Comment" ADD COLUMN "deletedByAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Comment" ADD COLUMN "deleteNotifiedAt" TIMESTAMP(3);
