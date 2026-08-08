-- ── Missing columns on existing tables ─────────────────────────────────────

-- TrainingSession
ALTER TABLE "TrainingSession"
  ADD COLUMN IF NOT EXISTS "targetLoad" INTEGER;

-- TrainingLoad
ALTER TABLE "TrainingLoad"
  ADD COLUMN IF NOT EXISTS "previousLoad" INTEGER,
  ADD COLUMN IF NOT EXISTS "previousRpe"  INTEGER,
  ADD COLUMN IF NOT EXISTS "version"      INTEGER NOT NULL DEFAULT 0;

-- EquipmentLoan
ALTER TABLE "EquipmentLoan"
  ADD COLUMN IF NOT EXISTS "returnNote" TEXT;

-- EquipmentUnit
ALTER TABLE "EquipmentUnit"
  ADD COLUMN IF NOT EXISTS "inspectionIntervalDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastInspectedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextInspectionDue"      TIMESTAMP(3);

-- SalesRecord
ALTER TABLE "SalesRecord"
  ADD COLUMN IF NOT EXISTS "ticketSerialNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt"          TIMESTAMP(3);

-- LedgerEntry
ALTER TABLE "LedgerEntry"
  ADD COLUMN IF NOT EXISTS "periodLocked" BOOLEAN NOT NULL DEFAULT false;

-- Injury
ALTER TABLE "Injury"
  ADD COLUMN IF NOT EXISTS "priorWeeklyLoad"        INTEGER,
  ADD COLUMN IF NOT EXISTS "dataRetentionFlaggedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dataRetentionReason"    TEXT;

-- PerformanceBonus
ALTER TABLE "PerformanceBonus"
  ADD COLUMN IF NOT EXISTS "executedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "triggeredAt" TIMESTAMP(3);

-- Sponsorship
ALTER TABLE "Sponsorship"
  ADD COLUMN IF NOT EXISTS "exposureCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "fanReach"      INTEGER,
  ADD COLUMN IF NOT EXISTS "mediaValue"    DECIMAL(12,2);

-- StaffRecord
ALTER TABLE "StaffRecord"
  ADD COLUMN IF NOT EXISTS "employmentStartDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "employmentEndDate"   TIMESTAMP(3);

-- JobApplication
ALTER TABLE "JobApplication"
  ADD COLUMN IF NOT EXISTS "referenceCheckConsent"   BOOLEAN,
  ADD COLUMN IF NOT EXISTS "referenceCheckConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dataRetentionDeadline"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dataRetentionFlaggedAt"  TIMESTAMP(3);

-- ── Missing tables ───────────────────────────────────────────────────────────

-- FacilityReservation
CREATE TABLE IF NOT EXISTS "FacilityReservation" (
  "id"           SERIAL PRIMARY KEY,
  "facilityZone" "FacilityZone" NOT NULL,
  "title"        TEXT NOT NULL,
  "startTime"    TIMESTAMP(3) NOT NULL,
  "endTime"      TIMESTAMP(3) NOT NULL,
  "notes"        TEXT,
  "reservedById" INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacilityReservation_reservedById_fkey"
    FOREIGN KEY ("reservedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- MonthlyBudgetSnapshot
CREATE TABLE IF NOT EXISTS "MonthlyBudgetSnapshot" (
  "id"           SERIAL PRIMARY KEY,
  "seasonId"     INTEGER NOT NULL,
  "year"         INTEGER NOT NULL,
  "month"        INTEGER NOT NULL,
  "snapshotData" JSONB NOT NULL,
  "totalBudget"  INTEGER NOT NULL,
  "totalActual"  INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyBudgetSnapshot_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyBudgetSnapshot_seasonId_year_month_key"
  ON "MonthlyBudgetSnapshot"("seasonId", "year", "month");

-- MonthlyOperationsSnapshot
CREATE TABLE IF NOT EXISTS "MonthlyOperationsSnapshot" (
  "id"           SERIAL PRIMARY KEY,
  "seasonId"     INTEGER NOT NULL,
  "year"         INTEGER NOT NULL,
  "month"        INTEGER NOT NULL,
  "snapshotData" JSONB NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyOperationsSnapshot_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyOperationsSnapshot_seasonId_year_month_key"
  ON "MonthlyOperationsSnapshot"("seasonId", "year", "month");
