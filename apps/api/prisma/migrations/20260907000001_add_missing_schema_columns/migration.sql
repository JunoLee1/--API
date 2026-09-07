-- AlterTable ClubSettings
ALTER TABLE "ClubSettings" ADD COLUMN IF NOT EXISTS "planApprovalLimit" INTEGER NOT NULL DEFAULT 10000000;
ALTER TABLE "ClubSettings" ADD COLUMN IF NOT EXISTS "reviewerDeptMap" JSONB;

-- AlterTable StaffSalary
ALTER TABLE "StaffSalary" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "JobApplication_postingId_email_key" ON "JobApplication"("postingId", "email");
