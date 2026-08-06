-- CreateEnum
CREATE TYPE "SafeguardReportStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'RESOLVED');

-- CreateTable
CREATE TABLE "SafeguardReport" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "contactInfo" TEXT,
    "accusedUserId" INTEGER,
    "status" "SafeguardReportStatus" NOT NULL DEFAULT 'RECEIVED',
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafeguardReport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SafeguardReport" ADD CONSTRAINT "SafeguardReport_accusedUserId_fkey" FOREIGN KEY ("accusedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
