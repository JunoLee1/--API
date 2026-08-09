-- JobPosting
ALTER TABLE "JobPosting"
  ADD COLUMN IF NOT EXISTS "budget" INTEGER;

-- JobApplication
ALTER TABLE "JobApplication"
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- SalesRecord
ALTER TABLE "SalesRecord"
  ADD COLUMN IF NOT EXISTS "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedById"  INTEGER;

-- Sponsorship
ALTER TABLE "Sponsorship"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- FacilityInspection
ALTER TABLE "FacilityInspection"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
