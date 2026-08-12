-- JobPosting에 planReportId 추가 (채용 계획보고서 승인 게이트)
ALTER TABLE "JobPosting" ADD COLUMN IF NOT EXISTS "planReportId" INTEGER UNIQUE;
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_planReportId_fkey"
  FOREIGN KEY ("planReportId") REFERENCES "PlanReport"(id) ON DELETE SET NULL ON UPDATE CASCADE;
