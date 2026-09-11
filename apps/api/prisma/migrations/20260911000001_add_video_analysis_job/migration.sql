-- CreateEnum
CREATE TYPE "VideoAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "VideoAnalysisJob" (
    "id" SERIAL NOT NULL,
    "prospectId" INTEGER NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "status" "VideoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "pipelineData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VideoAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VideoAnalysisJob" ADD CONSTRAINT "VideoAnalysisJob_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "VideoAnalysisJob_prospectId_idx" ON "VideoAnalysisJob"("prospectId");

-- AlterTable: ProspectVideoEvaluation.pipelineData
ALTER TABLE "ProspectVideoEvaluation" ADD COLUMN "pipelineData" JSONB;
