-- CreateEnum
CREATE TYPE "Confederation" AS ENUM ('UEFA', 'AFC', 'CONMEBOL', 'CONCACAF', 'CAF', 'OFC');

-- AlterTable
ALTER TABLE "League" ADD COLUMN "countryId" INTEGER;
ALTER TABLE "League" ADD COLUMN "confederation" "Confederation";

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
