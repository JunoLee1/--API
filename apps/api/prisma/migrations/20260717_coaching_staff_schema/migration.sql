-- CreateEnum
CREATE TYPE "PlayerDevelopmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVIEWED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TRAINING_LOAD_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'PLAYER_DEVELOPMENT_PLAN_ACTIVATED';

-- AlterTable
ALTER TABLE "TrainingResult" ADD COLUMN     "scoredById" INTEGER;

-- CreateTable
CREATE TABLE "CoachAvailability" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingLoad" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "rpe" INTEGER NOT NULL,
    "load" INTEGER,

    CONSTRAINT "TrainingLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDevelopmentPlan" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "coachId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "goals" TEXT NOT NULL,
    "notes" TEXT,
    "status" "PlayerDevelopmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDevelopmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingLoad_playerId_sessionId_key" ON "TrainingLoad"("playerId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDevelopmentPlan_playerId_seasonId_key" ON "PlayerDevelopmentPlan"("playerId", "seasonId");

-- AddForeignKey
ALTER TABLE "TrainingResult" ADD CONSTRAINT "TrainingResult_scoredById_fkey" FOREIGN KEY ("scoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAvailability" ADD CONSTRAINT "CoachAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAvailability" ADD CONSTRAINT "CoachAvailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLoad" ADD CONSTRAINT "TrainingLoad_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLoad" ADD CONSTRAINT "TrainingLoad_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDevelopmentPlan" ADD CONSTRAINT "PlayerDevelopmentPlan_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDevelopmentPlan" ADD CONSTRAINT "PlayerDevelopmentPlan_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDevelopmentPlan" ADD CONSTRAINT "PlayerDevelopmentPlan_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

