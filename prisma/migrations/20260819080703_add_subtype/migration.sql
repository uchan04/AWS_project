-- CreateEnum
CREATE TYPE "SubTypeCode" AS ENUM ('AFTERCARE_YOUTH', 'FAMILY_CAREGIVER', 'MIGRANT_YOUTH', 'HEALTH_FRAGILE', 'DEBT_INDEPENDENT', 'FINANCIAL_FRAGILE', 'JOBLESS_POOR', 'FAMILY_DEPENDENT');

-- AlterTable
ALTER TABLE "DiagnosisSession" ADD COLUMN     "indicators" JSONB,
ADD COLUMN     "subTypeCode" "SubTypeCode";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subTypeCode" "SubTypeCode";
