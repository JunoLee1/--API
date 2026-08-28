-- ─────────────────────────────────────────────────────────────
-- SurveyResponse workflow (issues #367 + #368):
--   * 팀장 (UserDepartment.role = 'LEADER') creates/edits DRAFT
--   * 팀장 submits DRAFT → SUBMITTED
--   * 부서장 (Department.headId) approves SUBMITTED → APPROVED
--   * 부서장 rejects SUBMITTED → REJECTED (with rejectionReason)
--   * 팀장 can edit REJECTED and re-submit
--
-- Adds:
--   * SurveyResponseStatus enum
--   * SurveyResponse.status / rejectionReason / approvedById / approvedAt
--   * 3 new NotificationType values for the workflow
--   * Status index for approval queue queries
-- ─────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "SurveyResponseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SURVEY_RESPONSE_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SURVEY_RESPONSE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SURVEY_RESPONSE_REJECTED';

-- AlterTable
--   Existing rows (created before this workflow) are treated as pre-approved so
--   they don't block HR close for surveys that were already responded to under
--   the old direct-head flow. New DRAFT records use the default going forward.
ALTER TABLE "SurveyResponse"
  ADD COLUMN "status" "SurveyResponseStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "approvedById" INTEGER,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Backfill: any pre-existing responses were submitted directly by the head, so
-- treat them as APPROVED to preserve prior close-eligibility semantics.
UPDATE "SurveyResponse" SET "status" = 'APPROVED' WHERE "status" = 'DRAFT';

-- CreateIndex
CREATE INDEX "SurveyResponse_status_idx" ON "SurveyResponse"("status");

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
