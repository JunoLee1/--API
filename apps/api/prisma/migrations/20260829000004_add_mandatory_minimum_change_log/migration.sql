-- CreateEnum
CREATE TYPE "MinimumEvidenceType" AS ENUM ('CONTRACT', 'LEGAL', 'FIXED_COST');

-- CreateEnum
CREATE TYPE "MinimumChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateTable
CREATE TABLE "MandatoryMinimumChangeLog" (
    "id" SERIAL NOT NULL,
    "categoryPlanId" INTEGER NOT NULL,
    "previousAmount" INTEGER NOT NULL,
    "newAmount" INTEGER NOT NULL,
    "evidenceType" "MinimumEvidenceType" NOT NULL,
    "evidenceUrl" TEXT,
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "MinimumChangeStatus" NOT NULL DEFAULT 'PENDING',
    "proposedById" INTEGER NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "MandatoryMinimumChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MandatoryMinimumChangeLog_categoryPlanId_status_idx" ON "MandatoryMinimumChangeLog"("categoryPlanId", "status");

-- AddForeignKey
ALTER TABLE "MandatoryMinimumChangeLog" ADD CONSTRAINT "MandatoryMinimumChangeLog_categoryPlanId_fkey" FOREIGN KEY ("categoryPlanId") REFERENCES "BudgetCategoryPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryMinimumChangeLog" ADD CONSTRAINT "MandatoryMinimumChangeLog_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryMinimumChangeLog" ADD CONSTRAINT "MandatoryMinimumChangeLog_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
