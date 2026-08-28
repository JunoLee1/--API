-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'SELF_REPORTED', 'DONE', 'SKIPPED');

-- Extend NotificationType enum with 5 new onboarding-related types
ALTER TYPE "NotificationType" ADD VALUE 'ONBOARDING_TASKS_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'ONBOARDING_TASK_VERIFY_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'ONBOARDING_TASK_VERIFIED';
ALTER TYPE "NotificationType" ADD VALUE 'ONBOARDING_TASK_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'ONBOARDING_CONTENT_COMPLETED';

-- AlterTable — add contentCompletedAt to distinguish from MFA completedAt
ALTER TABLE "Onboarding" ADD COLUMN "contentCompletedAt" TIMESTAMP(3);

-- CreateTable OnboardingTemplate (Department 1:1)
CREATE TABLE "OnboardingTemplate" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tasks" JSONB NOT NULL,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — Department 1:1 uniqueness
CREATE UNIQUE INDEX "OnboardingTemplate_departmentId_key" ON "OnboardingTemplate"("departmentId");

-- CreateTable OnboardingTask (per-Onboarding snapshot)
CREATE TABLE "OnboardingTask" (
    "id" SERIAL NOT NULL,
    "onboardingId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "order" INTEGER NOT NULL DEFAULT 0,
    "selfReportedAt" TIMESTAMP(3),
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "verifyNotes" TEXT,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — verify queue lookup + ordered rendering
CREATE INDEX "OnboardingTask_onboardingId_status_idx" ON "OnboardingTask"("onboardingId", "status");
CREATE INDEX "OnboardingTask_onboardingId_order_idx" ON "OnboardingTask"("onboardingId", "order");

-- AddForeignKey
ALTER TABLE "OnboardingTemplate"
    ADD CONSTRAINT "OnboardingTemplate_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingTemplate"
    ADD CONSTRAINT "OnboardingTemplate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnboardingTemplate"
    ADD CONSTRAINT "OnboardingTemplate_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingTask"
    ADD CONSTRAINT "OnboardingTask_onboardingId_fkey"
    FOREIGN KEY ("onboardingId") REFERENCES "Onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingTask"
    ADD CONSTRAINT "OnboardingTask_verifiedById_fkey"
    FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
