-- 신규 직원 팔로우업 / ProbationReview (issue #375)
--
-- Adds:
--   1) ClubSettings.probationMonths (cluster-wide probation length)
--   2) Enums: ProbationReviewType, ProbationReviewStatus, ProbationStatus
--   3) StaffRecord probation columns (probationStartedAt/EndedAt/Status)
--   4) ProbationReview model + FK + unique(staffRecordId, reviewType)
--   5) NotificationType: PROBATION_REVIEW_DUE_SOON, PROBATION_REVIEW_COMPLETED
--
-- Backfill: existing StaffRecord rows are already permanent employees,
--   so their probationStatus flips to PASSED. `probationStartedAt` remains
--   NULL for backfilled rows so the cron notifier will not fire for them.

-- 1) CreateEnum
CREATE TYPE "ProbationReviewType" AS ENUM ('THREE_MO', 'SIX_MO');
CREATE TYPE "ProbationReviewStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');
CREATE TYPE "ProbationStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED');

-- 2) ClubSettings: probationMonths
ALTER TABLE "ClubSettings" ADD COLUMN "probationMonths" INTEGER NOT NULL DEFAULT 3;

-- 3) StaffRecord: probation columns
ALTER TABLE "StaffRecord"
  ADD COLUMN "probationStartedAt" TIMESTAMP(3),
  ADD COLUMN "probationEndedAt"   TIMESTAMP(3),
  ADD COLUMN "probationStatus"    "ProbationStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- Backfill: existing rows are already permanent. Flip to PASSED so the
-- cron doesn't try to remind anyone on legacy records (which also have
-- probationStartedAt NULL — belt + suspenders).
UPDATE "StaffRecord" SET "probationStatus" = 'PASSED';

-- 4) ProbationReview table
CREATE TABLE "ProbationReview" (
  "id"               SERIAL NOT NULL,
  "staffRecordId"    INTEGER NOT NULL,
  "reviewType"       "ProbationReviewType" NOT NULL,
  "status"           "ProbationReviewStatus" NOT NULL DEFAULT 'PENDING',
  "leaderAssessment" TEXT,
  "reviewedById"     INTEGER,
  "reviewedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProbationReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProbationReview_staffRecordId_reviewType_key"
  ON "ProbationReview"("staffRecordId", "reviewType");

CREATE INDEX "ProbationReview_staffRecordId_status_idx"
  ON "ProbationReview"("staffRecordId", "status");

ALTER TABLE "ProbationReview"
  ADD CONSTRAINT "ProbationReview_staffRecordId_fkey"
  FOREIGN KEY ("staffRecordId") REFERENCES "StaffRecord"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProbationReview"
  ADD CONSTRAINT "ProbationReview_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) NotificationType additions
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROBATION_REVIEW_DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROBATION_REVIEW_COMPLETED';
