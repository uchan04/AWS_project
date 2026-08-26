-- 펫 외출 (2026-08-25, C). 친밀도 200 → 4시간 뒤 에피소드 + 재화.
-- 계획과 값의 근거는 docs/dev/pet.md "펫 외출 시스템".
--
-- 이 파일은 손으로 썼다. `prisma migrate dev`는 스키마 담당 1인만 실행한다(CLAUDE.md 5절).
-- 받는 쪽은 `npx prisma migrate deploy && npx prisma generate`만 실행한다.
--
-- **신규 표 1개만 만든다.** 기존 표의 컬럼을 건드리지 않는 것이 의도다 —
-- 8/24에 develop이 전면 500이 됐던 원인이 그것이었다(User에 컬럼이 늘었는데 DB에 안
-- 들어가서 findUnique의 SELECT가 P2022로 죽었다). 새 표는 그 표를 읽는 코드만 영향을
-- 받으므로, 마이그레이션이 늦게 적용되어도 로그인과 다른 화면은 그대로 돈다.
-- (그 유일한 코드인 lib/pet/outing.ts가 표 없음을 잡아 외출 카드만 숨긴다)
--
-- 되돌리기: DROP TABLE "PetOuting". 다른 표에 흔적이 없다.

CREATE TABLE "PetOuting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnsAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "placeKey" TEXT NOT NULL,
    "metKey" TEXT NOT NULL,
    "moodKey" TEXT NOT NULL,
    "gotSeeds" INTEGER NOT NULL DEFAULT 0,
    "gotShards" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PetOuting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PetOuting_userId_startedAt_idx" ON "PetOuting"("userId", "startedAt");

-- ★ 진행 중인 외출은 유저당 1건. **이 인덱스가 이 기능의 동시성 안전장치 전부다.**
-- 부분 유니크(WHERE claimedAt IS NULL)라 받아 간 옛 외출은 몇 건이든 남을 수 있고,
-- 안 받은 것만 1건으로 묶인다.
--
-- Prisma 스키마 문법에는 조건부 유니크가 없어서 여기 직접 쓴다 — `prisma migrate diff`나
-- `db push`로 이 파일을 재생성하면 **이 줄이 사라진다.** 그러면 "보내기"를 빠르게 두 번
-- 눌렀을 때 친밀도 400이 나가고 외출 2건이 생기는 구멍이 조용히 열린다.
-- 애플리케이션 사전 조회(findFirst 후 create)로는 막을 수 없다.
CREATE UNIQUE INDEX "PetOuting_active_uniq" ON "PetOuting"("userId") WHERE "claimedAt" IS NULL;

ALTER TABLE "PetOuting" ADD CONSTRAINT "PetOuting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
