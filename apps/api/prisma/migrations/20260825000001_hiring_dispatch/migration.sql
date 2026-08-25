-- CreateEnum
CREATE TYPE "HiringDispatchStatus" AS ENUM ('CREATED', 'BUDGET_REVERIFIED', 'DISPATCH_APPROVED', 'DISPATCHED', 'ONBOARDING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HiringDispatchStage" AS ENUM ('BUDGET_REVIEW', 'DISPATCH_APPROVAL', 'EXECUTION');

-- CreateEnum
CREATE TYPE "HiringDispatchAction" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'ADVISOR');

-- CreateEnum
CREATE TYPE "JobGrade" AS ENUM ('INTERN', 'JUNIOR', 'ASSOCIATE', 'MANAGER', 'DIRECTOR', 'EXECUTIVE');

-- DropForeignKey
ALTER TABLE "Onboarding" DROP CONSTRAINT "Onboarding_applicationId_fkey";

-- AlterTable
ALTER TABLE "Onboarding" ADD COLUMN     "hiringDispatchId" INTEGER,
ALTER COLUMN "applicationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "HiringDispatch" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobGrade" "JobGrade" NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "reportsToUserId" INTEGER,
    "monthlySalary" BIGINT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetRole" "Role" NOT NULL,
    "targetFrontOfficeRole" "FrontOfficeRole",
    "targetCoachingRole" "CoachingRole",
    "permissionNotes" TEXT,
    "status" "HiringDispatchStatus" NOT NULL DEFAULT 'CREATED',
    "createdUserId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringDispatchApproval" (
    "id" SERIAL NOT NULL,
    "dispatchId" INTEGER NOT NULL,
    "stage" "HiringDispatchStage" NOT NULL,
    "action" "HiringDispatchAction" NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringDispatchApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HiringDispatch_applicationId_key" ON "HiringDispatch"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "HiringDispatch_createdUserId_key" ON "HiringDispatch"("createdUserId");

-- CreateIndex
CREATE INDEX "HiringDispatch_status_createdAt_idx" ON "HiringDispatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HiringDispatch_departmentId_status_idx" ON "HiringDispatch"("departmentId", "status");

-- CreateIndex
CREATE INDEX "HiringDispatchApproval_dispatchId_stage_idx" ON "HiringDispatchApproval"("dispatchId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "HiringDispatchApproval_dispatchId_stage_key" ON "HiringDispatchApproval"("dispatchId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Onboarding_hiringDispatchId_key" ON "Onboarding"("hiringDispatchId");

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_hiringDispatchId_fkey" FOREIGN KEY ("hiringDispatchId") REFERENCES "HiringDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringDispatch" ADD CONSTRAINT "HiringDispatch_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringDispatch" ADD CONSTRAINT "HiringDispatch_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringDispatch" ADD CONSTRAINT "HiringDispatch_reportsToUserId_fkey" FOREIGN KEY ("reportsToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringDispatch" ADD CONSTRAINT "HiringDispatch_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringDispatch" ADD CONSTRAINT "HiringDispatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringDispatchApproval" ADD CONSTRAINT "HiringDispatchApproval_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "HiringDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringDispatchApproval" ADD CONSTRAINT "HiringDispatchApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

