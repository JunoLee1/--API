-- Rename FinancialReport.revenue* → plannedRevenue* (semantic clarification).
-- These fields have always been "planned/budgeted revenue", not actuals.
-- Actuals must be computed live from source tables (SalesRecord, SponsorshipPayment,
-- LedgerEntry). Dashboard was fixed in PR #311 to do so.

ALTER TABLE "FinancialReport" RENAME COLUMN "revenueTicket"        TO "plannedRevenueTicket";
ALTER TABLE "FinancialReport" RENAME COLUMN "revenueSponsorship"   TO "plannedRevenueSponsorship";
ALTER TABLE "FinancialReport" RENAME COLUMN "revenueBroadcast"     TO "plannedRevenueBroadcast";
ALTER TABLE "FinancialReport" RENAME COLUMN "revenueMerchandise"   TO "plannedRevenueMerchandise";
ALTER TABLE "FinancialReport" RENAME COLUMN "revenueSubsidy"       TO "plannedRevenueSubsidy";
ALTER TABLE "FinancialReport" RENAME COLUMN "revenueParentCompany" TO "plannedRevenueParentCompany";
ALTER TABLE "FinancialReport" RENAME COLUMN "revenueAcademyFee"    TO "plannedRevenueAcademyFee";
ALTER TABLE "FinancialReport" RENAME COLUMN "revenueOther"         TO "plannedRevenueOther";

-- Reset existing planned values that were populated by the old auto-fill implementation
-- (single previous season actuals written into the planned fields). Users will re-run
-- the new auto-fill (previous N-season average) once available. Only known season row
-- exists as of 2026-08-22; broader backfill is a no-op if a new FinancialReport row
-- has not been inserted yet.
UPDATE "FinancialReport" SET
  "plannedRevenueTicket"        = 0,
  "plannedRevenueSponsorship"   = 0,
  "plannedRevenueBroadcast"     = 0,
  "plannedRevenueMerchandise"   = 0,
  "plannedRevenueSubsidy"       = 0,
  "plannedRevenueParentCompany" = 0,
  "plannedRevenueAcademyFee"    = 0,
  "plannedRevenueOther"         = 0;
