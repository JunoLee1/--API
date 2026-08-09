-- AlterTable
ALTER TABLE "SalesRecord" ADD COLUMN IF NOT EXISTS "matchId" INTEGER;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
