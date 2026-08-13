-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SurveyPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'HIRING_SURVEY_OPEN';
ALTER TYPE "NotificationType" ADD VALUE 'HIRING_SURVEY_DEADLINE_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'HIRING_SURVEY_CLOSED';
ALTER TYPE "NotificationType" ADD VALUE 'HIRING_PLAN_APPROVED';

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN "hiringPlanItemId" INTEGER;

-- AlterTable
ALTER TABLE "PlanReport" ADD COLUMN "surveyId" INTEGER;

-- CreateTable
CREATE TABLE "HiringNeedsSurvey" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringNeedsSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyTargetDept" (
    "surveyId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,

    CONSTRAINT "SurveyTargetDept_pkey" PRIMARY KEY ("surveyId","departmentId")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" SERIAL NOT NULL,
    "surveyId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "quarter" INTEGER,
    "priority" "SurveyPriority" NOT NULL,
    "estimatedBudget" INTEGER,
    "reason" TEXT NOT NULL,
    "submittedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringPlanItem" (
    "id" SERIAL NOT NULL,
    "planReportId" INTEGER NOT NULL,
    "surveyResponseId" INTEGER,
    "roleTitle" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "quarter" INTEGER,
    "priority" "SurveyPriority" NOT NULL,
    "estimatedBudget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_departmentId_key" ON "SurveyResponse"("surveyId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "HiringPlanItem_surveyResponseId_key" ON "HiringPlanItem"("surveyResponseId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanReport_surveyId_key" ON "PlanReport"("surveyId");

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_hiringPlanItemId_fkey" FOREIGN KEY ("hiringPlanItemId") REFERENCES "HiringPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReport" ADD CONSTRAINT "PlanReport_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "HiringNeedsSurvey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringNeedsSurvey" ADD CONSTRAINT "HiringNeedsSurvey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyTargetDept" ADD CONSTRAINT "SurveyTargetDept_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "HiringNeedsSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyTargetDept" ADD CONSTRAINT "SurveyTargetDept_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "HiringNeedsSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringPlanItem" ADD CONSTRAINT "HiringPlanItem_planReportId_fkey" FOREIGN KEY ("planReportId") REFERENCES "PlanReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringPlanItem" ADD CONSTRAINT "HiringPlanItem_surveyResponseId_fkey" FOREIGN KEY ("surveyResponseId") REFERENCES "SurveyResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
