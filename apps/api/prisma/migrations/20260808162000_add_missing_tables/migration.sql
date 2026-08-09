-- SalesType enum: add missing values
ALTER TYPE "SalesType" ADD VALUE IF NOT EXISTS 'COMPLIMENTARY';
ALTER TYPE "SalesType" ADD VALUE IF NOT EXISTS 'VIP_TICKET';

-- MembershipTier enum
DO $$ BEGIN
  CREATE TYPE "MembershipTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fan
CREATE TABLE IF NOT EXISTS "Fan" (
  "id"        SERIAL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "email"     TEXT UNIQUE,
  "phone"     TEXT,
  "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FanMembership
CREATE TABLE IF NOT EXISTS "FanMembership" (
  "id"        SERIAL PRIMARY KEY,
  "fanId"     INTEGER NOT NULL,
  "tier"      "MembershipTier" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate"   TIMESTAMP(3) NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FanMembership_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- FanPurchase
CREATE TABLE IF NOT EXISTS "FanPurchase" (
  "id"          SERIAL PRIMARY KEY,
  "fanId"       INTEGER NOT NULL,
  "matchId"     INTEGER,
  "saleType"    "SalesType" NOT NULL,
  "quantity"    INTEGER NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "seatZone"    TEXT,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FanPurchase_fanId_fkey"   FOREIGN KEY ("fanId")   REFERENCES "Fan"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FanPurchase_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- SeatZone
CREATE TABLE IF NOT EXISTS "SeatZone" (
  "id"       SERIAL PRIMARY KEY,
  "name"     TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "matchId"  INTEGER NOT NULL,
  CONSTRAINT "SeatZone_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- InterviewerScore
CREATE TABLE IF NOT EXISTS "InterviewerScore" (
  "id"           SERIAL PRIMARY KEY,
  "interviewId"  INTEGER NOT NULL,
  "interviewerId" INTEGER NOT NULL,
  "scoreSkill"   INTEGER,
  "scoreComm"    INTEGER,
  "scoreCulture" INTEGER,
  "comment"      TEXT,
  CONSTRAINT "InterviewerScore_interviewId_fkey"   FOREIGN KEY ("interviewId")   REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InterviewerScore_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id")      ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InterviewerScore_interviewId_interviewerId_key"
  ON "InterviewerScore"("interviewId", "interviewerId");

-- RefreshTokenBlacklist
CREATE TABLE IF NOT EXISTS "RefreshTokenBlacklist" (
  "jti"       TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "RefreshTokenBlacklist_expiresAt_idx"
  ON "RefreshTokenBlacklist"("expiresAt");
