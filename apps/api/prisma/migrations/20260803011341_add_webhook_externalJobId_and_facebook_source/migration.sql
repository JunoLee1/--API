-- AlterEnum
ALTER TYPE "ApplicationSource" ADD VALUE 'FACEBOOK';

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN "externalJobId" TEXT;
