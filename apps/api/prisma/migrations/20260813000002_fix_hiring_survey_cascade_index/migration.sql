-- Fix 1: onDelete SetNull on JobPosting.hiringPlanItem
-- This is Prisma-level behavior only; the FK column is nullable so no DB constraint change needed.

-- Fix 2: Add index on surveyId in SurveyResponse
CREATE INDEX IF NOT EXISTS "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");
