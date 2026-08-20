-- DropForeignKey
ALTER TABLE "public"."GachaPull" DROP CONSTRAINT "GachaPull_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GachaPull" DROP CONSTRAINT "GachaPull_itemId_fkey";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "heroPity",
DROP COLUMN "legendPity";

-- AlterTable
ALTER TABLE "public"."PetSkin" DROP COLUMN "priceAffinity",
ADD COLUMN     "priceShards" INTEGER,
ALTER COLUMN "stageCount" SET DEFAULT 3;

-- AlterTable
ALTER TABLE "public"."CosmeticItem" DROP COLUMN "tribeColor";

-- DropTable
DROP TABLE "public"."GachaPull";

