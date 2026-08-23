-- Add carryOverFromPrev + manual override fields to FinancialReport.
-- The auto-calculated amount is filled by the closeSeason() hook from the
-- previous season's approved MonthlySettlementReport net income; users can
-- manually override via PATCH /financial-reports/:seasonId/carryover.
ALTER TABLE "FinancialReport"
  ADD COLUMN "carryOverFromPrev"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "carryOverOverriddenById"  INTEGER,
  ADD COLUMN "carryOverOverriddenAt"    TIMESTAMP(3),
  ADD COLUMN "carryOverOverrideReason"  TEXT;

ALTER TABLE "FinancialReport"
  ADD CONSTRAINT "FinancialReport_carryOverOverriddenById_fkey"
  FOREIGN KEY ("carryOverOverriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
