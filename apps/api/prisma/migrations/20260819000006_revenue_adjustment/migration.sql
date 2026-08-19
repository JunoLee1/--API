-- AccountCodeType enum
CREATE TYPE "AccountCodeType" AS ENUM ('REVENUE', 'EXPENSE');

-- RevenueField enum
CREATE TYPE "RevenueField" AS ENUM (
  'TICKET', 'SPONSORSHIP', 'BROADCAST', 'MERCHANDISE',
  'SUBSIDY', 'PARENT_COMPANY', 'ACADEMY_FEE', 'OTHER'
);

-- MERCHANDISE to LedgerEntryCategory enum
ALTER TYPE "LedgerEntryCategory" ADD VALUE IF NOT EXISTS 'MERCHANDISE';

-- AccountCode table
CREATE TABLE "AccountCode" (
  "id"        SERIAL PRIMARY KEY,
  "code"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "type"      "AccountCodeType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountCode_code_key" UNIQUE ("code")
);

-- LedgerEntry: isAdjustment + accountCodeId
ALTER TABLE "LedgerEntry"
  ADD COLUMN "isAdjustment"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "accountCodeId" INTEGER REFERENCES "AccountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OperatingExpense: accountCodeId
ALTER TABLE "OperatingExpense"
  ADD COLUMN "accountCodeId" INTEGER REFERENCES "AccountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RevenueAdjustment table
CREATE TABLE "RevenueAdjustment" (
  "id"                SERIAL PRIMARY KEY,
  "financialReportId" INTEGER REFERENCES "FinancialReport"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "monthlyReportId"   INTEGER REFERENCES "MonthlySettlementReport"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "field"             "RevenueField" NOT NULL,
  "delta"             INTEGER NOT NULL,
  "memo"              TEXT,
  "createdById"       INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ledgerEntryId"     INTEGER UNIQUE REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "must_have_target"
    CHECK ("financialReportId" IS NOT NULL OR "monthlyReportId" IS NOT NULL)
);

-- Seed default AccountCodes
INSERT INTO "AccountCode" ("code", "name", "type") VALUES
  ('4101', '입장권수익',        'REVENUE'),
  ('4102', '스폰서십수익',      'REVENUE'),
  ('4103', '방송권수익',        'REVENUE'),
  ('4104', '상품수익',          'REVENUE'),
  ('4105', '보조금수익',        'REVENUE'),
  ('4106', '모기업지원',        'REVENUE'),
  ('4107', '유소년아카데미수익','REVENUE'),
  ('4108', '기타수익',          'REVENUE'),
  ('5101', '식비',              'EXPENSE'),
  ('5102', '교통비',            'EXPENSE'),
  ('5103', '장비비',            'EXPENSE'),
  ('5104', '스카우팅비',        'EXPENSE'),
  ('5105', '유소년육성비',      'EXPENSE');
