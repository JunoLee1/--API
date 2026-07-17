-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('FIRST_TEAM', 'YOUTH');

-- CreateEnum
CREATE TYPE "CoachStatus" AS ENUM ('CANDIDATE', 'SHORTLISTED', 'APPROVAL_PENDING', 'CONTRACTED', 'RETIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShortlistSource" AS ENUM ('SYSTEM', 'MANUAL');

-- CreateEnum
CREATE TYPE "TutorType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "HiringRoundStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "BonusTeamScope" AS ENUM ('ALL', 'FIRST_TEAM_ONLY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COACH_AUTO_SHORTLISTED';
ALTER TYPE "NotificationType" ADD VALUE 'COACH_MANUALLY_SHORTLISTED';
ALTER TYPE "NotificationType" ADD VALUE 'COACH_APPROVAL_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'COACH_CONTRACTED';
ALTER TYPE "NotificationType" ADD VALUE 'COACH_HEAD_CONTRACTED';
ALTER TYPE "NotificationType" ADD VALUE 'COACH_ARCHIVED';
ALTER TYPE "NotificationType" ADD VALUE 'COACH_TUTOR_SUPPORT_NEEDED';

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_reviewerId_fkey";

-- AlterTable
ALTER TABLE "BonusTrigger" ADD COLUMN     "teamScope" "BonusTeamScope" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "teamId" INTEGER;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "teamId" INTEGER;

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "teamId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "teamId" INTEGER;

-- DropEnum
DROP TYPE "Type";

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TeamType" NOT NULL,
    "ageGroup" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackStats" BOOLEAN NOT NULL DEFAULT true,
    "requiresContract" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachHiringRound" (
    "id" SERIAL NOT NULL,
    "targetRole" "CoachingRole" NOT NULL,
    "fitScoreThreshold" INTEGER NOT NULL DEFAULT 70,
    "status" "HiringRoundStatus" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "budget" INTEGER,
    "notes" TEXT,
    "result" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachHiringRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT,
    "coachingRole" "CoachingRole" NOT NULL,
    "status" "CoachStatus" NOT NULL DEFAULT 'CANDIDATE',
    "shortlistSource" "ShortlistSource",
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "packageLeadId" INTEGER,
    "hiringRoundId" INTEGER,
    "userId" INTEGER,
    "teamId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeadCoachEvaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "possession" DOUBLE PRECISION,
    "pressingIntensity" DOUBLE PRECISION,
    "progressivePassAccuracy" DOUBLE PRECISION,
    "teamActivity" DOUBLE PRECISION,
    "philosophyFitScore" DOUBLE PRECISION,
    "dataSource" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "HeadCoachEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefensiveCoachEvaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "tackleSuccessRate" DOUBLE PRECISION,
    "clearances" DOUBLE PRECISION,
    "blocks" DOUBLE PRECISION,
    "defensiveErrors" DOUBLE PRECISION,
    "ballRecovery" DOUBLE PRECISION,
    "pressingIntensity" DOUBLE PRECISION,
    "dataSource" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "DefensiveCoachEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackingCoachEvaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "xG" DOUBLE PRECISION,
    "xA" DOUBLE PRECISION,
    "chanceCreation" DOUBLE PRECISION,
    "dribbleSuccessRate" DOUBLE PRECISION,
    "progressivePassAccuracy" DOUBLE PRECISION,
    "shotConversionRate" DOUBLE PRECISION,
    "goalInvolvement" DOUBLE PRECISION,
    "dataSource" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "AttackingCoachEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalkeeperCoachEvaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "psxG" DOUBLE PRECISION,
    "xGConcededDiff" DOUBLE PRECISION,
    "buildupPassAccuracy" DOUBLE PRECISION,
    "dataSource" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "GoalkeeperCoachEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachTier2Evaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "fitScore" INTEGER,
    "notes" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "CoachTier2Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachTutorAssignment" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "type" "TutorType" NOT NULL,
    "internalTutorId" INTEGER,
    "externalName" TEXT,
    "externalContact" TEXT,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "languageProficiency" "LanguageProficiency",
    "tacticalImplementationRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachTutorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coach_userId_key" ON "Coach"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HeadCoachEvaluation_coachId_key" ON "HeadCoachEvaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "DefensiveCoachEvaluation_coachId_key" ON "DefensiveCoachEvaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "AttackingCoachEvaluation_coachId_key" ON "AttackingCoachEvaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalkeeperCoachEvaluation_coachId_key" ON "GoalkeeperCoachEvaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachTier2Evaluation_coachId_key" ON "CoachTier2Evaluation"("coachId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachHiringRound" ADD CONSTRAINT "CoachHiringRound_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_packageLeadId_fkey" FOREIGN KEY ("packageLeadId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_hiringRoundId_fkey" FOREIGN KEY ("hiringRoundId") REFERENCES "CoachHiringRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeadCoachEvaluation" ADD CONSTRAINT "HeadCoachEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefensiveCoachEvaluation" ADD CONSTRAINT "DefensiveCoachEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackingCoachEvaluation" ADD CONSTRAINT "AttackingCoachEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalkeeperCoachEvaluation" ADD CONSTRAINT "GoalkeeperCoachEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTier2Evaluation" ADD CONSTRAINT "CoachTier2Evaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTutorAssignment" ADD CONSTRAINT "CoachTutorAssignment_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTutorAssignment" ADD CONSTRAINT "CoachTutorAssignment_internalTutorId_fkey" FOREIGN KEY ("internalTutorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
