-- 스킨을 종족 전용 외형으로 바꾸고, 치장의 종족 구분과 가챠를 없앤다.
-- 삭제되는 값: CosmeticItem.tribeColor 12행(종족 구분 폐지), PetSkin.priceAffinity 3행
-- (늑대·삵·판다. 변종 스킨으로 대체되며 시드에서 제거된다), User.heroPity·legendPity(값 전부 0),
-- GachaPull 0행. 상세 근거는 docs/dev/diagnosis.md 15절.

-- DropForeignKey
ALTER TABLE "GachaPull" DROP CONSTRAINT "GachaPull_itemId_fkey";

-- DropForeignKey
ALTER TABLE "GachaPull" DROP CONSTRAINT "GachaPull_userId_fkey";

-- AlterTable
ALTER TABLE "CosmeticItem" DROP COLUMN "tribeColor";

-- AlterTable
ALTER TABLE "PetSkin" DROP COLUMN "priceAffinity",
ADD COLUMN     "priceShards" INTEGER,
ALTER COLUMN "stageCount" SET DEFAULT 3;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "heroPity",
DROP COLUMN "legendPity";

-- DropTable
DROP TABLE "GachaPull";
