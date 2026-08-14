CREATE TABLE IF NOT EXISTS "LedgerPeriodLock" (
  "id" SERIAL NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "lockedById" INTEGER NOT NULL,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerPeriodLock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerPeriodLock_year_month_key" ON "LedgerPeriodLock"("year", "month");
ALTER TABLE "LedgerPeriodLock" ADD CONSTRAINT "LedgerPeriodLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
