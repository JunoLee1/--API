-- AlterEnum
ALTER TYPE "FrontOfficeRole" ADD VALUE 'ASSET_MANAGER';

-- AlterTable
ALTER TABLE "Department" ADD COLUMN "parentId" INTEGER;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
