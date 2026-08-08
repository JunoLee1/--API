ALTER TABLE "FinancialReport"
  ADD COLUMN "revenueTicket"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revenueSponsorship"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revenueBroadcast"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revenueMerchandise"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revenueSubsidy"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revenueParentCompany" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revenueOther"         INTEGER NOT NULL DEFAULT 0;
