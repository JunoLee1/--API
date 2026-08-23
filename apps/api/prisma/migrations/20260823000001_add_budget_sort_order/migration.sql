-- Add sortOrder column to BudgetCategoryPlan and BudgetTier so wizard can
-- persist user-controlled drag-and-drop ordering.
ALTER TABLE "BudgetCategoryPlan" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BudgetTier"         ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill BudgetCategoryPlan.sortOrder from the ExpenseCategory table when
-- available (PR D Phase 1 set categoryId FK), falling back to the legacy
-- OperatingCategory enum ordinal for rows that predate the FK.
UPDATE "BudgetCategoryPlan" bcp
   SET "sortOrder" = ec."sortOrder"
  FROM "ExpenseCategory" ec
 WHERE bcp."categoryId" = ec.id;

-- Legacy fallback for any rows whose categoryId is still NULL. Matches the
-- original OperatingCategory enum declaration order (MEDICAL/MEAL/TRAVEL/
-- EQUIPMENT/SCOUTING/YOUTH).
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 0 WHERE "categoryId" IS NULL AND "category" = 'MEDICAL';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 1 WHERE "categoryId" IS NULL AND "category" = 'MEAL';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 2 WHERE "categoryId" IS NULL AND "category" = 'TRAVEL';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 3 WHERE "categoryId" IS NULL AND "category" = 'EQUIPMENT';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 4 WHERE "categoryId" IS NULL AND "category" = 'SCOUTING';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 5 WHERE "categoryId" IS NULL AND "category" = 'YOUTH';

-- Backfill BudgetTier.sortOrder: within each categoryPlan, order by id so we
-- preserve historical creation order as the initial user-facing sequence.
UPDATE "BudgetTier" t
   SET "sortOrder" = sub.rn - 1
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "categoryPlanId" ORDER BY id) AS rn
      FROM "BudgetTier"
  ) sub
 WHERE t.id = sub.id;
