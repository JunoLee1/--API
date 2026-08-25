-- AlterEnum: NotificationType ADD VALUE — must run OUTSIDE transaction block
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_ISSUED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_RETURN_REQUIRED';

-- CreateEnum: MedicalEquipmentLoanStatus
CREATE TYPE "MedicalEquipmentLoanStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'ISSUED',
  'EMERGENCY_ISSUED',
  'EMERGENCY_PENDING_POST_APPROVAL',
  'EMERGENCY_RESOLVED',
  'EMERGENCY_REJECTED',
  'RETURNED'
);

-- CreateTable: MedicalEquipmentLoanLedger
CREATE TABLE "MedicalEquipmentLoanLedger" (
  "id"                  SERIAL PRIMARY KEY,
  "equipmentLoanId"     INTEGER NOT NULL UNIQUE,
  "status"              "MedicalEquipmentLoanStatus" NOT NULL DEFAULT 'DRAFT',
  "requestedById"       INTEGER NOT NULL,
  "approvedById"        INTEGER,
  "approvedAt"          TIMESTAMP(3),
  "rejectedById"        INTEGER,
  "rejectedAt"          TIMESTAMP(3),
  "rejectionReason"     TEXT,
  "isEmergency"         BOOLEAN NOT NULL DEFAULT false,
  "emergencyReason"     TEXT,
  "partnerId"           INTEGER,
  "partnerContractId"   INTEGER,
  "sponsorshipId"       INTEGER,
  "discountRate"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "originalCost"        INTEGER NOT NULL DEFAULT 0,
  "finalCost"           INTEGER NOT NULL DEFAULT 0,
  "overrideReason"      TEXT,
  "budgetLineId"        INTEGER,
  "operatingExpenseId"  INTEGER UNIQUE,
  "escalatedAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);

-- FK constraints
ALTER TABLE "MedicalEquipmentLoanLedger"
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_equipmentLoanId_fkey"
    FOREIGN KEY ("equipmentLoanId") REFERENCES "EquipmentLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_rejectedById_fkey"
    FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_partnerContractId_fkey"
    FOREIGN KEY ("partnerContractId") REFERENCES "PartnerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_sponsorshipId_fkey"
    FOREIGN KEY ("sponsorshipId") REFERENCES "Sponsorship"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_budgetLineId_fkey"
    FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_operatingExpenseId_fkey"
    FOREIGN KEY ("operatingExpenseId") REFERENCES "OperatingExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
