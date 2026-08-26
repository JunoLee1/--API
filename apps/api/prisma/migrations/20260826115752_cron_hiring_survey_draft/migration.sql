-- AlterEnum
ALTER TYPE "SurveyStatus" ADD VALUE 'DRAFT';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'HIRING_SURVEY_DRAFT_CREATED';

-- AlterTable
ALTER TABLE "ClubSettings" ADD COLUMN     "autoSurveyTopN" INTEGER DEFAULT 3;
