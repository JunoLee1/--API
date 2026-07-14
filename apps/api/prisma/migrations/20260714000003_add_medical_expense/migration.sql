-- CreateEnum
CREATE TYPE "ExpenseCostCategory" AS ENUM ('OUTPATIENT', 'EXAMINATION', 'SURGERY', 'REHABILITATION', 'MEDICATION');

-- CreateEnum
CREATE TYPE "ExpensePayerType" AS ENUM ('CLUB', 'ASSOCIATION', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "MedicalExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LEADER_APPROVED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MedicalExpense" (
    "id"              SERIAL NOT NULL,
    "status"          "MedicalExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "injuryId"        INTEGER,
    "receiptDate"     TIMESTAMP(3) NOT NULL,
    "costCategory"    "ExpenseCostCategory" NOT NULL,
    "totalAmount"     INTEGER NOT NULL,
    "payerType"       "ExpensePayerType" NOT NULL,
    "description"     TEXT,
    "fileUrl"         TEXT,
    "fileName"        TEXT,
    "rejectionReason" TEXT,
    "submittedById"   INTEGER NOT NULL,
    "leaderReviewerId" INTEGER,
    "adminReviewerId"  INTEGER,
    "submittedAt"      TIMESTAMP(3),
    "leaderReviewedAt" TIMESTAMP(3),
    "adminReviewedAt"  TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalExpense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_injuryId_fkey"
    FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_leaderReviewerId_fkey"
    FOREIGN KEY ("leaderReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_adminReviewerId_fkey"
    FOREIGN KEY ("adminReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
