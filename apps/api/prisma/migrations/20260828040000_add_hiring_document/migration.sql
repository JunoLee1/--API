-- CreateEnum
CREATE TYPE "HiringDocReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "HiringDispatch" ADD COLUMN "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "HiringDocument" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER,
    "hiringDispatchId" INTEGER,
    "docType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "status" "HiringDocReviewStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringDocument_applicationId_docType_createdAt_idx"
  ON "HiringDocument"("applicationId", "docType", "createdAt" DESC);
CREATE INDEX "HiringDocument_hiringDispatchId_docType_createdAt_idx"
  ON "HiringDocument"("hiringDispatchId", "docType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "HiringDocument"
  ADD CONSTRAINT "HiringDocument_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HiringDocument"
  ADD CONSTRAINT "HiringDocument_hiringDispatchId_fkey"
  FOREIGN KEY ("hiringDispatchId") REFERENCES "HiringDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HiringDocument"
  ADD CONSTRAINT "HiringDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HiringDocument"
  ADD CONSTRAINT "HiringDocument_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
