-- CreateEnum
CREATE TYPE "VideoEvalResult" AS ENUM ('PASS', 'FAIL', 'PENDING');

-- CreateEnum
CREATE TYPE "EvaluationLogType" AS ENUM ('VIDEO_ANALYSIS', 'CONSISTENCY', 'FIELD_VISIT', 'LEAGUE_LEVEL');

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "currentMarketValue" INTEGER;

-- CreateTable
CREATE TABLE "ProspectVideoEvaluation" (
    "id" SERIAL NOT NULL,
    "prospectId" INTEGER NOT NULL,
    "qualityPassed" BOOLEAN NOT NULL,
    "identifiable" BOOLEAN NOT NULL,
    "continuity" BOOLEAN NOT NULL,
    "totalScore" INTEGER,
    "scoreData" JSONB,
    "result" "VideoEvalResult" NOT NULL,
    "notes" TEXT,
    "evaluatedById" INTEGER NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectVideoEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectEvaluationLog" (
    "id" SERIAL NOT NULL,
    "prospectId" INTEGER NOT NULL,
    "type" "EvaluationLogType" NOT NULL,
    "note" TEXT NOT NULL,
    "evaluatedById" INTEGER NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectEvaluationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectVideoEvaluation_prospectId_idx" ON "ProspectVideoEvaluation"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectEvaluationLog_prospectId_idx" ON "ProspectEvaluationLog"("prospectId");

-- AddForeignKey
ALTER TABLE "ProspectVideoEvaluation" ADD CONSTRAINT "ProspectVideoEvaluation_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectVideoEvaluation" ADD CONSTRAINT "ProspectVideoEvaluation_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectEvaluationLog" ADD CONSTRAINT "ProspectEvaluationLog_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectEvaluationLog" ADD CONSTRAINT "ProspectEvaluationLog_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
