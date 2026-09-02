-- #476 (ADR 0024): FinancialReport.expectedRevenueSponsorship (accrual by dueDate ∈ season).
-- Nullable for backward compat. plannedRevenueSponsorship 은 Actual (cash) 유지.
--
-- Type = DOUBLE PRECISION (Prisma Float?) — not INTEGER. Deviation from ADR/plan:
-- 실측 sponsorship 총합이 INT4 범위(2.1B) 를 초과하는 시즌 확인. Sibling
-- plannedRevenueSponsorship 도 DOUBLE PRECISION 이라 일관성 유지.
ALTER TABLE "FinancialReport" ADD COLUMN "expectedRevenueSponsorship" DOUBLE PRECISION;
