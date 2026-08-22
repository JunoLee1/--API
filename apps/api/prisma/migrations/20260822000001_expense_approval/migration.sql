-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'FIRST_APPROVED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- AlterEnum: BudgetLine.category String -> OperatingCategory
ALTER TABLE "BudgetLine" ALTER COLUMN "category" TYPE "OperatingCategory" USING "category"::"OperatingCategory";

-- AlterTable: OperatingExpense - add approval fields and status
ALTER TABLE "OperatingExpense"
  ADD COLUMN "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "budgetLineId" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "firstApprovedById" INTEGER,
  ADD COLUMN "firstApprovedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" INTEGER,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" INTEGER,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "cancelledById" INTEGER,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT;

-- Remove the default on budgetLineId after adding it (required for NOT NULL with existing rows)
ALTER TABLE "OperatingExpense" ALTER COLUMN "budgetLineId" DROP DEFAULT;

-- AddForeignKey: OperatingExpense -> BudgetLine
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: OperatingExpense -> User (firstApprovedBy)
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_firstApprovedById_fkey" FOREIGN KEY ("firstApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: OperatingExpense -> User (approvedBy)
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: OperatingExpense -> User (rejectedBy)
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: OperatingExpense -> User (cancelledBy)
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
