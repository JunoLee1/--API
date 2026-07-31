-- AlterTable: change FK constraint to CASCADE
ALTER TABLE "FinancialReport" DROP CONSTRAINT "FinancialReport_seasonId_fkey";
ALTER TABLE "FinancialReport" ADD CONSTRAINT "FinancialReport_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
