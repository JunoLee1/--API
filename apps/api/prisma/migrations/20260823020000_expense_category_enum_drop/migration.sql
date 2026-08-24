-- ─────────────────────────────────────────────────────────────
-- Migration B: OperatingCategory enum → ExpenseCategory table cutover
--   * Enforce NOT NULL on categoryId (Migration A left it nullable)
--   * Replace old FK (ON DELETE SET NULL) with RESTRICT (Prisma default
--     for required relations — safer, prevents orphaning)
--   * Swap BudgetCategoryPlan unique from (financialReportId, category)
--     to (financialReportId, categoryId)
--   * Drop the four "category" enum columns
--   * Drop the OperatingCategory enum type
--
-- Runs inside a single implicit transaction. Partial state impossible.
-- ─────────────────────────────────────────────────────────────

-- Safety asserts: refuse to run if backfill was skipped.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "OperatingExpense" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Aborting: OperatingExpense has rows with NULL categoryId. Run migration A backfill first.';
  END IF;
  IF EXISTS (SELECT 1 FROM "BudgetCategoryPlan" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Aborting: BudgetCategoryPlan has rows with NULL categoryId.';
  END IF;
  IF EXISTS (SELECT 1 FROM "BudgetLine" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Aborting: BudgetLine has rows with NULL categoryId.';
  END IF;
  IF EXISTS (SELECT 1 FROM "BudgetOverrideLog" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Aborting: BudgetOverrideLog has rows with NULL categoryId.';
  END IF;
END $$;

-- Drop old FKs (created with ON DELETE SET NULL in Migration A).
ALTER TABLE "BudgetCategoryPlan" DROP CONSTRAINT "BudgetCategoryPlan_categoryId_fkey";
ALTER TABLE "BudgetOverrideLog"  DROP CONSTRAINT "BudgetOverrideLog_categoryId_fkey";
ALTER TABLE "OperatingExpense"   DROP CONSTRAINT "OperatingExpense_categoryId_fkey";
ALTER TABLE "BudgetLine"         DROP CONSTRAINT "BudgetLine_categoryId_fkey";

-- Promote categoryId to NOT NULL.
ALTER TABLE "OperatingExpense"   ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "BudgetCategoryPlan" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "BudgetLine"         ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "BudgetOverrideLog"  ALTER COLUMN "categoryId" SET NOT NULL;

-- Re-add FKs with RESTRICT (Prisma default for required relations).
ALTER TABLE "BudgetCategoryPlan" ADD CONSTRAINT "BudgetCategoryPlan_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BudgetOverrideLog"  ADD CONSTRAINT "BudgetOverrideLog_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperatingExpense"   ADD CONSTRAINT "OperatingExpense_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BudgetLine"         ADD CONSTRAINT "BudgetLine_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Swap unique constraint on BudgetCategoryPlan.
DROP INDEX "BudgetCategoryPlan_financialReportId_category_key";
CREATE UNIQUE INDEX "BudgetCategoryPlan_financialReportId_categoryId_key"
  ON "BudgetCategoryPlan"("financialReportId", "categoryId");

-- Drop the four old enum columns.
ALTER TABLE "OperatingExpense"   DROP COLUMN "category";
ALTER TABLE "BudgetCategoryPlan" DROP COLUMN "category";
ALTER TABLE "BudgetLine"         DROP COLUMN "category";
ALTER TABLE "BudgetOverrideLog"  DROP COLUMN "category";

-- Drop orphan tables that referenced OperatingCategory but were removed
-- from the Prisma schema without a corresponding migration. These tables
-- (DepartmentAnnualPlan / DepartmentBudgetItem / DepartmentKpiItem) were
-- created by migration 20260809000001_add_department_annual_plan and are
-- no longer part of the schema — production already dropped them out of
-- band, so on that env these DROPs are no-ops (IF EXISTS is safe).
DROP TABLE IF EXISTS "DepartmentBudgetItem";
DROP TABLE IF EXISTS "DepartmentKpiItem";
DROP TABLE IF EXISTS "DepartmentAnnualPlan";

-- Drop the enum type.
DROP TYPE "OperatingCategory";
