-- FinancialReport에 예산 필드 추가
ALTER TABLE "FinancialReport"
  ADD COLUMN "totalOperatingBudget" INTEGER,
  ADD COLUMN "contingencyReserve"   INTEGER NOT NULL DEFAULT 0;

-- OperatingCategory enum
CREATE TYPE "OperatingCategory" AS ENUM ('MEDICAL','MEAL','TRAVEL','EQUIPMENT','SCOUTING','YOUTH');

-- BudgetCategoryPlan
CREATE TABLE "BudgetCategoryPlan" (
  "id"                SERIAL NOT NULL,
  "financialReportId" INTEGER NOT NULL,
  "category"          "OperatingCategory" NOT NULL,
  "mandatoryMinimum"  INTEGER NOT NULL DEFAULT 0,
  "knapsackAllocated" INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetCategoryPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BudgetCategoryPlan_financialReportId_category_key"
  ON "BudgetCategoryPlan"("financialReportId","category");
ALTER TABLE "BudgetCategoryPlan"
  ADD CONSTRAINT "BudgetCategoryPlan_financialReportId_fkey"
  FOREIGN KEY ("financialReportId") REFERENCES "FinancialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BudgetTier
CREATE TABLE "BudgetTier" (
  "id"             SERIAL NOT NULL,
  "categoryPlanId" INTEGER NOT NULL,
  "name"           TEXT NOT NULL,
  "cost"           INTEGER NOT NULL,
  "value"          INTEGER NOT NULL,
  "isSelected"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetTier_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "BudgetTier"
  ADD CONSTRAINT "BudgetTier_categoryPlanId_fkey"
  FOREIGN KEY ("categoryPlanId") REFERENCES "BudgetCategoryPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BudgetOverrideLog
CREATE TABLE "BudgetOverrideLog" (
  "id"                SERIAL NOT NULL,
  "financialReportId" INTEGER NOT NULL,
  "category"          "OperatingCategory" NOT NULL,
  "amount"            INTEGER NOT NULL,
  "reason"            TEXT NOT NULL,
  "createdById"       INTEGER NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetOverrideLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "BudgetOverrideLog"
  ADD CONSTRAINT "BudgetOverrideLog_financialReportId_fkey"
  FOREIGN KEY ("financialReportId") REFERENCES "FinancialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetOverrideLog"
  ADD CONSTRAINT "BudgetOverrideLog_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;

-- OperatingExpense
CREATE TABLE "OperatingExpense" (
  "id"          SERIAL NOT NULL,
  "seasonId"    INTEGER NOT NULL,
  "category"    "OperatingCategory" NOT NULL,
  "amount"      INTEGER NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "note"        TEXT,
  "createdById" INTEGER NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperatingExpense_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "OperatingExpense"
  ADD CONSTRAINT "OperatingExpense_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON UPDATE CASCADE;
ALTER TABLE "OperatingExpense"
  ADD CONSTRAINT "OperatingExpense_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
