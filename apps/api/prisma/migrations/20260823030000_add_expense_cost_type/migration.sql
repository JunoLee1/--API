-- Add ExpenseCostType enum + OperatingExpense.costType column
-- Nullable so existing rows don't need backfill; new submissions require it via FE.

CREATE TYPE "ExpenseCostType" AS ENUM ('FIXED', 'VARIABLE', 'CONTINGENCY');

ALTER TABLE "OperatingExpense" ADD COLUMN "costType" "ExpenseCostType";
