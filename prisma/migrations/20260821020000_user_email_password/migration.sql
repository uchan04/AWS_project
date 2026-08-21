-- 자체 DB 계정(이메일+비밀번호) 지원. 기존 Cognito 계정 행은 두 컬럼이 NULL로 남는다.
-- 둘 다 nullable이라 기존 데이터에 영향이 없다.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
