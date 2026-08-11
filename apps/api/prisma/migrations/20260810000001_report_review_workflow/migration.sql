-- AlterEnum: add REVIEWING to ReportStatus
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'REVIEWING';

-- AlterEnum: add REJECTED to ReviewStatus (for ReportReview)
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- CreateTable: ReportReview
CREATE TABLE "ReportReview" (
  "id"             SERIAL NOT NULL,
  "reportId"       INTEGER NOT NULL,
  "reviewerDeptId" INTEGER NOT NULL,
  "status"         "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "comment"        TEXT,
  "confirmedById"  INTEGER,
  "confirmedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReviewRuleSet
CREATE TABLE "ReviewRuleSet" (
  "id"               SERIAL NOT NULL,
  "reportType"       "ReportType" NOT NULL,
  "reviewerCategory" "DepartmentCategory" NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReviewRuleSet_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex
CREATE UNIQUE INDEX "ReportReview_reportId_reviewerDeptId_key"
  ON "ReportReview"("reportId", "reviewerDeptId");

CREATE UNIQUE INDEX "ReviewRuleSet_reportType_reviewerCategory_key"
  ON "ReviewRuleSet"("reportType", "reviewerCategory");

-- AddForeignKey: ReportReview → Report
ALTER TABLE "ReportReview" ADD CONSTRAINT "ReportReview_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ReportReview → Department
ALTER TABLE "ReportReview" ADD CONSTRAINT "ReportReview_reviewerDeptId_fkey"
  FOREIGN KEY ("reviewerDeptId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ReportReview → User
ALTER TABLE "ReportReview" ADD CONSTRAINT "ReportReview_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
