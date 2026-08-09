-- AlterTable: add reversedById self-relation to LedgerEntry
ALTER TABLE "LedgerEntry" ADD COLUMN "reversedById" INTEGER;

-- CreateIndex: unique constraint ensures one reversal per original entry
CREATE UNIQUE INDEX "LedgerEntry_reversedById_key" ON "LedgerEntry"("reversedById");

-- AddForeignKey: self-referencing FK for reversal tracking
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
