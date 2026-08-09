-- AlterTable
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "countryId" INTEGER;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
