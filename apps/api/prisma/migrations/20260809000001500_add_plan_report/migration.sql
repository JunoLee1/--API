-- CreateEnum
CREATE TYPE "PlanTemplateType" AS ENUM ('GENERAL', 'HR', 'MARKETING', 'GOODS', 'SQUAD', 'MEDICAL', 'IT');

-- CreateEnum
CREATE TYPE "ApproverLevel" AS ENUM ('HEAD', 'GM', 'ADMIN');

-- CreateTable
CREATE TABLE "PlanReport" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "budget" INTEGER NOT NULL,
    "expectedEffect" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resultDueDate" TIMESTAMP(3) NOT NULL,
    "templateType" "PlanTemplateType" NOT NULL,
    "extraFields" JSONB,
    "hasNewStaff" BOOLEAN NOT NULL DEFAULT false,
    "hasContract" BOOLEAN NOT NULL DEFAULT false,
    "hasExternalLease" BOOLEAN NOT NULL DEFAULT false,
    "hasPersonalInfo" BOOLEAN NOT NULL DEFAULT false,
    "isNewBusiness" BOOLEAN NOT NULL DEFAULT false,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "requiredApproverLevel" "ApproverLevel",
    "rejectionReason" TEXT,
    "resultContent" TEXT,
    "resultSubmittedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "vaultPath" TEXT,
    "createdById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanReport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanReport" ADD CONSTRAINT "PlanReport_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReport" ADD CONSTRAINT "PlanReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReport" ADD CONSTRAINT "PlanReport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
