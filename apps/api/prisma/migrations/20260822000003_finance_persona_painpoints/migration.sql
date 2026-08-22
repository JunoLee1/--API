-- CreateEnum
CREATE TYPE "OverrideStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "BudgetOverrideLog"
  ADD COLUMN "status" "OverrideStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewedById" INTEGER,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT;

-- CreateTable
CREATE TABLE "FinancialReportRevenueLog" (
    "id" SERIAL NOT NULL,
    "financialReportId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" DOUBLE PRECISION NOT NULL,
    "newValue" DOUBLE PRECISION NOT NULL,
    "changedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialReportRevenueLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BudgetOverrideLog"
  ADD CONSTRAINT "BudgetOverrideLog_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReportRevenueLog"
  ADD CONSTRAINT "FinancialReportRevenueLog_financialReportId_fkey"
  FOREIGN KEY ("financialReportId") REFERENCES "FinancialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReportRevenueLog"
  ADD CONSTRAINT "FinancialReportRevenueLog_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
