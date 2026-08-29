-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM (
  'MULTI_LOCATION',
  'DIRECT_BUSINESS',
  'PUBLIC_UTILITY',
  'HOME_MATCH',
  'WEEKEND_OVERTIME'
);

-- CreateEnum
CREATE TYPE "BudgetPlanRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PROCESSED');

-- CreateTable
CREATE TABLE "BudgetPlanRequest" (
  "id"                SERIAL NOT NULL,
  "financialReportId" INTEGER NOT NULL,
  "requestedById"     INTEGER NOT NULL,
  "scope"             "CategoryScope" NOT NULL,
  "ownerType"         TEXT NOT NULL,
  "ownerId"           INTEGER NOT NULL,
  "status"            "BudgetPlanRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt"       TIMESTAMP(3),
  "processedAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BudgetPlanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPlanRequest_financialReportId_ownerType_ownerId_key"
  ON "BudgetPlanRequest"("financialReportId", "ownerType", "ownerId");

-- CreateTable
CREATE TABLE "BudgetPlanRequestLine" (
  "id"            SERIAL NOT NULL,
  "requestId"     INTEGER NOT NULL,
  "categoryId"    INTEGER NOT NULL,
  "triggers"      "TriggerType"[] DEFAULT ARRAY[]::"TriggerType"[],
  "standardDelta" INTEGER NOT NULL DEFAULT 0,
  "premiumDelta"  INTEGER NOT NULL DEFAULT 0,
  "evidenceUrl"   TEXT,
  "comment"       TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BudgetPlanRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPlanRequestLine_requestId_categoryId_key"
  ON "BudgetPlanRequestLine"("requestId", "categoryId");

-- AddForeignKey
ALTER TABLE "BudgetPlanRequest"
  ADD CONSTRAINT "BudgetPlanRequest_financialReportId_fkey"
  FOREIGN KEY ("financialReportId") REFERENCES "FinancialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetPlanRequest"
  ADD CONSTRAINT "BudgetPlanRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BudgetPlanRequestLine"
  ADD CONSTRAINT "BudgetPlanRequestLine_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "BudgetPlanRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetPlanRequestLine"
  ADD CONSTRAINT "BudgetPlanRequestLine_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
