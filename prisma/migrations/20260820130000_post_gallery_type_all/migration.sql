-- CreateEnum
CREATE TYPE "GalleryType" AS ENUM ('INDEPENDENT_LOW_INCOME', 'HEALTH_EMOTION', 'FAMILY_LIVING', 'ALL');

-- AlterTable
-- 값 이름이 TypeCode와 같아서 text 경유 캐스팅으로 기존 데이터를 보존한다.
-- Prisma가 자동 생성하는 drop+recreate 스크립트는 NOT NULL 재생성 시 기존 행이 있으면 실패한다.
ALTER TABLE "Post" ALTER COLUMN "galleryType" TYPE "GalleryType" USING ("galleryType"::text::"GalleryType");
