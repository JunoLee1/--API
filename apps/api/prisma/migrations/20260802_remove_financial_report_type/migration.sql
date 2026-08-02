CREATE TYPE "ReportType_new" AS ENUM ('PERFORMANCE', 'MEDICAL', 'TRAINING');
ALTER TABLE "Report" ALTER COLUMN "type" TYPE "ReportType_new" USING "type"::text::"ReportType_new";
DROP TYPE "ReportType";
ALTER TYPE "ReportType_new" RENAME TO "ReportType";
