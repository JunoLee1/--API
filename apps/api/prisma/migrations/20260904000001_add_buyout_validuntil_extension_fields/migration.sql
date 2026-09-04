ALTER TABLE "BuyoutClause" ADD COLUMN "validUntil" TIMESTAMP(3);
ALTER TABLE "ExtensionOption" ADD COLUMN "conditionText" TEXT;
ALTER TABLE "ExtensionOption" ADD COLUMN "minAppearances" INTEGER;
