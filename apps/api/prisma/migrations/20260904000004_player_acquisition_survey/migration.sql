CREATE TABLE IF NOT EXISTS "PlayerAcquisitionSurvey" (
  "id"          SERIAL PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "status"      "SurveyStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate"     TIMESTAMP(3),
  "notes"       TEXT,
  "createdById" INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"    TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "PlayerAcquisitionSurvey_status_idx" ON "PlayerAcquisitionSurvey"("status");

CREATE TABLE IF NOT EXISTS "PlayerAcquisitionSurveyResponse" (
  "id"           SERIAL PRIMARY KEY,
  "surveyId"     INTEGER NOT NULL REFERENCES "PlayerAcquisitionSurvey"("id") ON DELETE CASCADE,
  "respondentId" INTEGER NOT NULL REFERENCES "User"("id"),
  "submittedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerAcquisitionSurveyResponse_surveyId_respondentId_key" UNIQUE ("surveyId", "respondentId")
);
CREATE INDEX IF NOT EXISTS "PlayerAcquisitionSurveyResponse_surveyId_idx" ON "PlayerAcquisitionSurveyResponse"("surveyId");

CREATE TABLE IF NOT EXISTS "PlayerAcquisitionSurveyResponseItem" (
  "id"         SERIAL PRIMARY KEY,
  "responseId" INTEGER NOT NULL REFERENCES "PlayerAcquisitionSurveyResponse"("id") ON DELETE CASCADE,
  "position"   "Position" NOT NULL,
  "priority"   "SurveyPriority" NOT NULL,
  "budgetMin"  INTEGER,
  "budgetMax"  INTEGER,
  "notes"      TEXT
);
CREATE INDEX IF NOT EXISTS "PlayerAcquisitionSurveyResponseItem_responseId_idx" ON "PlayerAcquisitionSurveyResponseItem"("responseId");
