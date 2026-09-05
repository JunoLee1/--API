ALTER TABLE "Prospect" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Prospect_externalId_key" ON "Prospect"("externalId");
