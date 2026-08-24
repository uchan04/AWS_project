-- 오프라인 모임 (관리자 개설 · 유저 신청).
-- 이 파일은 손으로 썼다. `prisma migrate dev`는 스키마 담당 1인만 실행한다(CLAUDE.md 5절).
-- 받는 쪽은 `npx prisma migrate deploy && npx prisma generate`만 실행한다.
--
-- 신규 테이블 2개 + nullable 아닌 컬럼 1개(User.isAdmin)를 추가한다.
-- isAdmin은 DEFAULT false라 기존 행에 손대지 않는다.

CREATE TYPE "MeetupStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CANCELED');

ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Meetup" (
    "id" TEXT NOT NULL,
    "galleryType" "GalleryType" NOT NULL,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "minCount" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL,
    "joinCount" INTEGER NOT NULL DEFAULT 0,
    "status" "MeetupStatus" NOT NULL DEFAULT 'OPEN',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Meetup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetupParticipant" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "MeetupParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Meetup_galleryType_startsAt_idx" ON "Meetup"("galleryType", "startsAt");
CREATE INDEX "Meetup_status_startsAt_idx" ON "Meetup"("status", "startsAt");
CREATE INDEX "MeetupParticipant_userId_idx" ON "MeetupParticipant"("userId");
CREATE UNIQUE INDEX "MeetupParticipant_meetupId_userId_key" ON "MeetupParticipant"("meetupId", "userId");

ALTER TABLE "Meetup" ADD CONSTRAINT "Meetup_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetupParticipant" ADD CONSTRAINT "MeetupParticipant_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetupParticipant" ADD CONSTRAINT "MeetupParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
