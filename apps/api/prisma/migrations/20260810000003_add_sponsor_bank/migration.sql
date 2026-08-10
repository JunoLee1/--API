ALTER TABLE "Sponsorship"
  ADD COLUMN "domesticBankName"      TEXT,
  ADD COLUMN "domesticAccountNumber" TEXT,
  ADD COLUMN "domesticAccountHolder" TEXT,
  ADD COLUMN "ukBankName"            TEXT,
  ADD COLUMN "ukSortCode"            TEXT,
  ADD COLUMN "ukAccountNumber"       TEXT,
  ADD COLUMN "ukSwiftBic"            TEXT;
