-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TypeCode" AS ENUM ('INDEPENDENT_LOW_INCOME', 'HEALTH_EMOTION', 'FAMILY_LIVING');

-- CreateEnum
CREATE TYPE "Adjective" AS ENUM ('QUIET', 'WARM', 'DILIGENT', 'EASYGOING');

-- CreateEnum
CREATE TYPE "MissionScope" AS ENUM ('DAILY', 'STAGE');

-- CreateEnum
CREATE TYPE "Slot" AS ENUM ('HAT', 'SCARF', 'BACKGROUND');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "EffectType" AS ENUM ('NONE', 'SEED', 'SHARD', 'AFFINITY');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "cognitoSub" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '',
    "typeCode" "TypeCode",
    "adjective" "Adjective",
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "evolutionStage" INTEGER NOT NULL DEFAULT 1,
    "seeds" INTEGER NOT NULL DEFAULT 0,
    "starShards" INTEGER NOT NULL DEFAULT 0,
    "affinity" INTEGER NOT NULL DEFAULT 0,
    "affinityToday" INTEGER NOT NULL DEFAULT 0,
    "affinityTodayDate" TIMESTAMP(3),
    "activePetSkinId" TEXT,
    "heroPity" INTEGER NOT NULL DEFAULT 0,
    "legendPity" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastStreakDate" TIMESTAMP(3),
    "lastMissionResetAt" TIMESTAMP(3),
    "lastIdleClaimAt" TIMESTAMP(3),
    "attendanceTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "typeCode" "TypeCode" NOT NULL,
    "adjective" "Adjective" NOT NULL,
    "reasonText" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosisSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" "MissionScope" NOT NULL,
    "typeCode" "TypeCode",
    "stage" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rewardSeeds" INTEGER NOT NULL DEFAULT 0,
    "rewardShards" INTEGER NOT NULL DEFAULT 0,
    "rewardAffinity" INTEGER NOT NULL DEFAULT 0,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "resetKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoKey" TEXT,

    CONSTRAINT "UserMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetSkin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeCode" "TypeCode" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "stageCount" INTEGER NOT NULL DEFAULT 1,
    "effectType" "EffectType" NOT NULL DEFAULT 'NONE',
    "effectPct" INTEGER NOT NULL DEFAULT 0,
    "priceAffinity" INTEGER,
    "imageKeyBase" TEXT NOT NULL,

    CONSTRAINT "PetSkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPetSkin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "petSkinId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPetSkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slot" "Slot" NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "tribeColor" "TypeCode" NOT NULL,
    "affinityOnly" BOOLEAN NOT NULL DEFAULT false,
    "priceAffinity" INTEGER,
    "imageKey" TEXT NOT NULL,

    CONSTRAINT "CosmeticItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaPull" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "wasPity" BOOLEAN NOT NULL DEFAULT false,
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "refundShards" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GachaPull_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimDate" DATE NOT NULL,
    "dayIndex" INTEGER NOT NULL,

    CONSTRAINT "AttendanceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "galleryType" "TypeCode" NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageKey" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_cognitoSub_key" ON "User"("cognitoSub");

-- CreateIndex
CREATE INDEX "DiagnosisSession_userId_completedAt_idx" ON "DiagnosisSession"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_code_key" ON "Mission"("code");

-- CreateIndex
CREATE INDEX "UserMission_userId_resetKey_idx" ON "UserMission"("userId", "resetKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserMission_userId_missionId_resetKey_key" ON "UserMission"("userId", "missionId", "resetKey");

-- CreateIndex
CREATE UNIQUE INDEX "PetSkin_name_key" ON "PetSkin"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserPetSkin_userId_petSkinId_key" ON "UserPetSkin"("userId", "petSkinId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticItem_name_key" ON "CosmeticItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserCosmetic_userId_itemId_key" ON "UserCosmetic"("userId", "itemId");

-- CreateIndex
CREATE INDEX "GachaPull_userId_pulledAt_idx" ON "GachaPull"("userId", "pulledAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceClaim_userId_claimDate_key" ON "AttendanceClaim"("userId", "claimDate");

-- CreateIndex
CREATE INDEX "Post_galleryType_createdAt_idx" ON "Post"("galleryType", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activePetSkinId_fkey" FOREIGN KEY ("activePetSkinId") REFERENCES "PetSkin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisSession" ADD CONSTRAINT "DiagnosisSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMission" ADD CONSTRAINT "UserMission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMission" ADD CONSTRAINT "UserMission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPetSkin" ADD CONSTRAINT "UserPetSkin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPetSkin" ADD CONSTRAINT "UserPetSkin_petSkinId_fkey" FOREIGN KEY ("petSkinId") REFERENCES "PetSkin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceClaim" ADD CONSTRAINT "AttendanceClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

