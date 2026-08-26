-- CreateEnum
CREATE TYPE "HiringPlanItemStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED');

-- AlterTable
ALTER TABLE "HiringPlanItem" ADD COLUMN     "status" "HiringPlanItemStatus" NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "HiringPlanItem" ADD COLUMN     "fulfilledCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HiringPlanItem" ADD COLUMN     "fulfilledAt" TIMESTAMP(3);

-- Backfill: HiringPlanItem 이 JobPosting 을 이미 가지고 있으면 IN_PROGRESS 로 mark
UPDATE "HiringPlanItem" SET "status" = 'IN_PROGRESS'
WHERE id IN (SELECT DISTINCT "hiringPlanItemId" FROM "JobPosting" WHERE "hiringPlanItemId" IS NOT NULL);
