-- ─────────────────────────────────────────────────────────────
-- JobApplication offer 3-stage approval (fix #370)
--   Bottom-up flow: 팀장 (LEADER) → 부서장 (DEPT_HEAD) → HR
--   6 new JobApplicationStatus enum values (3 pending + 3 rejected)
--   New JobApplicationOfferApproval table (AssetRequestApproval 패턴)
-- ─────────────────────────────────────────────────────────────

-- AlterEnum: JobApplicationStatus — add 6 new values (OFFERED/REJECTED 유지)
-- IF NOT EXISTS matches the repo convention (see 20260810000000_dept_extensibility,
-- 20260808162000_add_missing_tables) so re-running the migration is idempotent.
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_PENDING_LEADER';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_PENDING_DEPT_HEAD';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_PENDING_HR';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_LEADER_REJECTED';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_DEPT_HEAD_REJECTED';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_HR_REJECTED';

-- CreateEnum
CREATE TYPE "JobApplicationOfferApprovalStage" AS ENUM ('LEADER', 'DEPT_HEAD', 'HR');

-- CreateEnum
CREATE TYPE "JobApplicationOfferApprovalAction" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "JobApplicationOfferApproval" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "stage" "JobApplicationOfferApprovalStage" NOT NULL,
    "action" "JobApplicationOfferApprovalAction" NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplicationOfferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobApplicationOfferApproval_applicationId_stage_idx" ON "JobApplicationOfferApproval"("applicationId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplicationOfferApproval_applicationId_stage_key" ON "JobApplicationOfferApproval"("applicationId", "stage");

-- AddForeignKey
ALTER TABLE "JobApplicationOfferApproval" ADD CONSTRAINT "JobApplicationOfferApproval_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicationOfferApproval" ADD CONSTRAINT "JobApplicationOfferApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
