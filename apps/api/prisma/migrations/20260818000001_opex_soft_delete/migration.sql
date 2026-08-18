ALTER TABLE "OperatingExpense" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "OperatingExpense" ADD COLUMN "deletionReason" TEXT;
