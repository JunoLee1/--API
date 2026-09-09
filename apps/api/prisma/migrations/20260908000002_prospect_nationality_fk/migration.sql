-- DropColumn
ALTER TABLE "public"."Prospect" DROP COLUMN IF EXISTS "nationality";

-- AddColumn
ALTER TABLE "public"."Prospect" ADD COLUMN "nationalityId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Prospect"
  ADD CONSTRAINT "Prospect_nationalityId_fkey"
  FOREIGN KEY ("nationalityId") REFERENCES "public"."Country"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
