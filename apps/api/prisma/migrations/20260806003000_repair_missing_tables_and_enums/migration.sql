-- Repair missing enum values and tables not created by the partial 20260802163055 migration.
-- All statements are idempotent (IF NOT EXISTS / exception handlers).

-- 1. MaintenanceStatus: add values missing from repair-db.js baseline
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- 2. Create EquipmentLoanStatus enum if missing
DO $$ BEGIN
  CREATE TYPE "EquipmentLoanStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ISSUED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create JobPostingStatus enum if missing
DO $$ BEGIN
  CREATE TYPE "JobPostingStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Create JobApplicationStatus enum if missing
DO $$ BEGIN
  CREATE TYPE "JobApplicationStatus" AS ENUM (
    'APPLIED', 'SCREENING', 'INTERVIEW_1', 'INTERVIEW_2',
    'REFERENCE_CHECK', 'OFFERED', 'ONBOARDED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. EquipmentLoan table
CREATE TABLE IF NOT EXISTS "EquipmentLoan" (
    "id"              SERIAL NOT NULL,
    "status"          "EquipmentLoanStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById"   INTEGER NOT NULL,
    "approvedById"    INTEGER,
    "issuedAt"        TIMESTAMP(3),
    "returnedAt"      TIMESTAMP(3),
    "notes"           TEXT,
    "equipmentItemId" INTEGER NOT NULL,
    "equipmentUnitId" INTEGER,
    CONSTRAINT "EquipmentLoan_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_equipmentItemId_fkey"
    FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_equipmentUnitId_fkey"
    FOREIGN KEY ("equipmentUnitId") REFERENCES "EquipmentUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. JobPosting table
CREATE TABLE IF NOT EXISTS "JobPosting" (
    "id"          SERIAL NOT NULL,
    "title"       TEXT NOT NULL,
    "departmentId" INTEGER,
    "headcount"   INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "status"      "JobPostingStatus" NOT NULL DEFAULT 'DRAFT',
    "externalJobId" TEXT,
    "createdById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "approvedAt"  TIMESTAMP(3),
    "closedAt"    TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. JobApplication table
CREATE TABLE IF NOT EXISTS "JobApplication" (
    "id"                  SERIAL NOT NULL,
    "postingId"           INTEGER NOT NULL,
    "applicantName"       TEXT NOT NULL,
    "email"               TEXT NOT NULL,
    "phone"               TEXT,
    "resumeUrl"           TEXT,
    "status"              "JobApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "rejectedAt"          TIMESTAMP(3),
    "offeredAt"           TIMESTAMP(3),
    "offeredById"         INTEGER,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source"              "ApplicationSource",
    "externalApplicantId" TEXT,
    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_postingId_fkey"
    FOREIGN KEY ("postingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_offeredById_fkey"
    FOREIGN KEY ("offeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "JobApplication_postingId_externalApplicantId_key"
  ON "JobApplication"("postingId", "externalApplicantId");
