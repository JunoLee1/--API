-- CreateEnum
CREATE TYPE "EmployeeContractStatus" AS ENUM ('DRAFT', 'ISSUED', 'SIGNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmployeeContract" (
    "id" SERIAL NOT NULL,
    "hiringDispatchId" INTEGER NOT NULL,
    "status" "EmployeeContractStatus" NOT NULL DEFAULT 'DRAFT',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "signedFileUrl" TEXT,
    "signedFileName" TEXT,
    "createdById" INTEGER NOT NULL,
    "issuedById" INTEGER,
    "issuedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedConfirmedById" INTEGER,
    "signedConfirmedAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeContract_hiringDispatchId_createdAt_idx"
  ON "EmployeeContract"("hiringDispatchId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_hiringDispatchId_fkey"
  FOREIGN KEY ("hiringDispatchId") REFERENCES "HiringDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_signedConfirmedById_fkey"
  FOREIGN KEY ("signedConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
