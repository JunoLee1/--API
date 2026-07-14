CREATE TYPE "ReportType" AS ENUM ('FINANCIAL', 'PERFORMANCE');
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "Report" (
  "id"              SERIAL PRIMARY KEY,
  "type"            "ReportType" NOT NULL,
  "status"          "ReportStatus" NOT NULL DEFAULT 'DRAFT',
  "title"           TEXT NOT NULL,
  "content"         TEXT NOT NULL,
  "fileUrl"         TEXT,
  "fileName"        TEXT,
  "rejectionReason" TEXT,
  "authorId"        INTEGER NOT NULL REFERENCES "User"("id"),
  "reviewerId"      INTEGER REFERENCES "User"("id"),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt"     TIMESTAMP(3),
  "reviewedAt"      TIMESTAMP(3)
);
