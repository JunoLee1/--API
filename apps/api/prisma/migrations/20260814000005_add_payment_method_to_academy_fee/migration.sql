-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PG', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "AcademyFee" ADD COLUMN "paymentMethod" "PaymentMethod",
ADD COLUMN "pgTransactionId" TEXT,
ADD COLUMN "receiptIssuedAt" TIMESTAMP(3);
