-- AlterTable
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "countryId" INTEGER;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'League_countryId_fkey'
  ) THEN
    ALTER TABLE "League" ADD CONSTRAINT "League_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
