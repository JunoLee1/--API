-- ─────────────────────────────────────────────────────────────
-- AssetRequest workflow: 2-stage approval (LEADER → DEPT_HEAD)
--   * 4 new enum types
--   * AssetRequest + AssetRequestApproval tables
--   * OperatingExpense.departmentId (nullable FK) — populated
--     when an approved AssetRequest spawns an OperatingExpense
-- ─────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "AssetRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LEADER_APPROVED', 'LEADER_REJECTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "AssetRequestType" AS ENUM ('SOFTWARE', 'HARDWARE');

-- CreateEnum
CREATE TYPE "AssetRequestApprovalStage" AS ENUM ('LEADER', 'DEPT_HEAD');

-- CreateEnum
CREATE TYPE "AssetRequestApprovalAction" AS ENUM ('APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "OperatingExpense" ADD COLUMN "departmentId" INTEGER;

-- CreateTable
CREATE TABLE "AssetRequest" (
    "id" SERIAL NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "type" "AssetRequestType" NOT NULL,
    "status" "AssetRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "equipmentItemId" INTEGER,
    "softwareLicenseId" INTEGER,
    "customName" TEXT,
    "customDescription" TEXT,
    "expenseCategoryId" INTEGER NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "neededBy" TIMESTAMP(3),
    "justification" TEXT NOT NULL,
    "operatingExpenseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRequestApproval" (
    "id" SERIAL NOT NULL,
    "assetRequestId" INTEGER NOT NULL,
    "stage" "AssetRequestApprovalStage" NOT NULL,
    "action" "AssetRequestApprovalAction" NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetRequestApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetRequest_requesterId_status_idx" ON "AssetRequest"("requesterId", "status");

-- CreateIndex
CREATE INDEX "AssetRequest_departmentId_status_idx" ON "AssetRequest"("departmentId", "status");

-- CreateIndex
CREATE INDEX "AssetRequest_status_createdAt_idx" ON "AssetRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AssetRequestApproval_assetRequestId_stage_idx" ON "AssetRequestApproval"("assetRequestId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRequestApproval_assetRequestId_stage_key" ON "AssetRequestApproval"("assetRequestId", "stage");

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_softwareLicenseId_fkey" FOREIGN KEY ("softwareLicenseId") REFERENCES "SoftwareLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_operatingExpenseId_fkey" FOREIGN KEY ("operatingExpenseId") REFERENCES "OperatingExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequestApproval" ADD CONSTRAINT "AssetRequestApproval_assetRequestId_fkey" FOREIGN KEY ("assetRequestId") REFERENCES "AssetRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequestApproval" ADD CONSTRAINT "AssetRequestApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
