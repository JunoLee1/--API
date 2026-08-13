-- Add new enum values
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'AGENT';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'REFERRAL';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'PLATFORM';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'INTERNAL';

-- Backfill NULLs before NOT NULL
UPDATE "JobApplication" SET "source" = 'DIRECT' WHERE "source" IS NULL;

-- Make non-nullable with default
ALTER TABLE "JobApplication" ALTER COLUMN "source" SET NOT NULL;
ALTER TABLE "JobApplication" ALTER COLUMN "source" SET DEFAULT 'DIRECT';
