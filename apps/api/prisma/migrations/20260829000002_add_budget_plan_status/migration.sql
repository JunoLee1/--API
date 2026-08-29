-- CreateEnum
CREATE TYPE "BudgetPlanStatus" AS ENUM (
  'DRAFT',
  'CAPACITY_FAILED',
  'AWAITING_REVIEW',
  'KNAPSACK_EXECUTED',
  'AWAITING_GM_APPROVAL',
  'FINALIZED',
  'RE_PLANNING'
);

-- AlterTable — FinancialReport 에 편성 상태 머신 필드 추가.
-- 기존 시즌은 FINALIZED 로 backfill (default 로 자동).
ALTER TABLE "FinancialReport"
  ADD COLUMN "planStatus"            "BudgetPlanStatus" NOT NULL DEFAULT 'FINALIZED',
  ADD COLUMN "planStatusChangedAt"   TIMESTAMP(3),
  ADD COLUMN "planStatusChangedById" INTEGER,
  ADD COLUMN "reviewOpenedAt"        TIMESTAMP(3),
  ADD COLUMN "reviewDeadline"        TIMESTAMP(3),
  ADD COLUMN "knapsackExecutedAt"    TIMESTAMP(3),
  ADD COLUMN "finalizedAt"           TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "FinancialReport"
  ADD CONSTRAINT "FinancialReport_planStatusChangedById_fkey"
  FOREIGN KEY ("planStatusChangedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
