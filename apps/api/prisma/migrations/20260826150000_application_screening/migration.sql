-- CreateEnum
CREATE TYPE "ScreeningResult" AS ENUM ('PENDING', 'PASS', 'FAIL');

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "screenedAt" TIMESTAMP(3),
ADD COLUMN     "screenedById" INTEGER,
ADD COLUMN     "screeningNotes" TEXT,
ADD COLUMN     "screeningResult" "ScreeningResult" NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_screenedById_fkey" FOREIGN KEY ("screenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
