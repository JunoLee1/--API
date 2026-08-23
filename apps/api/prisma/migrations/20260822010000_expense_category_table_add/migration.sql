-- AlterTable
ALTER TABLE "BudgetCategoryPlan" ADD COLUMN     "categoryId" INTEGER;

-- AlterTable
ALTER TABLE "BudgetOverrideLog" ADD COLUMN     "categoryId" INTEGER;

-- AlterTable
ALTER TABLE "OperatingExpense" ADD COLUMN     "categoryId" INTEGER;

-- AlterTable
ALTER TABLE "BudgetLine" ADD COLUMN     "categoryId" INTEGER;

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- AddForeignKey
ALTER TABLE "BudgetCategoryPlan" ADD CONSTRAINT "BudgetCategoryPlan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetOverrideLog" ADD CONSTRAINT "BudgetOverrideLog_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- Seed ExpenseCategory rows (9 total: 6 existing + 3 new)
-- EQUIPMENT is renamed to SPORTS_EQUIPMENT at seed time.
-- ─────────────────────────────────────────────
INSERT INTO "ExpenseCategory" ("code", "label", "sortOrder", "isActive", "updatedAt") VALUES
  ('MEDICAL',            '의료·재활',            0, true, NOW()),
  ('MEAL',               '식대',                 1, true, NOW()),
  ('TRAVEL',             '이동·숙박',            2, true, NOW()),
  ('SPORTS_EQUIPMENT',   '스포츠 장비·유니폼',   3, true, NOW()),
  ('SCOUTING',           '스카우팅·영입',        4, true, NOW()),
  ('YOUTH',              '유소년 개발',          5, true, NOW()),
  ('IT_SECURITY',        'IT·보안',              6, true, NOW()),
  ('FACILITY_EQUIPMENT', '시설·장비 관리',       7, true, NOW()),
  ('STAFF_RECRUITMENT',  '직원 채용',            8, true, NOW());

-- ─────────────────────────────────────────────
-- Backfill categoryId for existing rows.
-- Old enum value 'EQUIPMENT' maps to new code 'SPORTS_EQUIPMENT'.
-- All other enum values map to their identical code.
-- ─────────────────────────────────────────────

UPDATE "OperatingExpense" oe
  SET "categoryId" = ec.id
  FROM "ExpenseCategory" ec
  WHERE ec.code = CASE oe.category::text
    WHEN 'EQUIPMENT' THEN 'SPORTS_EQUIPMENT'
    ELSE oe.category::text
  END;

UPDATE "BudgetCategoryPlan" bcp
  SET "categoryId" = ec.id
  FROM "ExpenseCategory" ec
  WHERE ec.code = CASE bcp.category::text
    WHEN 'EQUIPMENT' THEN 'SPORTS_EQUIPMENT'
    ELSE bcp.category::text
  END;

UPDATE "BudgetLine" bl
  SET "categoryId" = ec.id
  FROM "ExpenseCategory" ec
  WHERE ec.code = CASE bl.category::text
    WHEN 'EQUIPMENT' THEN 'SPORTS_EQUIPMENT'
    ELSE bl.category::text
  END;

UPDATE "BudgetOverrideLog" bol
  SET "categoryId" = ec.id
  FROM "ExpenseCategory" ec
  WHERE ec.code = CASE bol.category::text
    WHEN 'EQUIPMENT' THEN 'SPORTS_EQUIPMENT'
    ELSE bol.category::text
  END;
