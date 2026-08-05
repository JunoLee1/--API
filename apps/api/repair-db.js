// Emergency repair: adds missing User columns regardless of Prisma migration state.
// Runs once on container startup, before prisma migrate deploy.
const { Client } = require('pg');

const sql = `
DO $repair$ BEGIN
  CREATE TYPE "CoachingRole" AS ENUM (
    'HEAD_COACH','ASSISTANT_COACH','DEFENSIVE_COACH','ATTACKING_COACH',
    'PHYSICAL_COACH','SET_PIECE_COACH','GOALKEEPER_COACH','MEDICAL','MEDICAL_DIRECTOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $repair$;

DO $repair2$ BEGIN
  CREATE TYPE "FrontOfficeRole" AS ENUM (
    'TD','CONTRACT_MANAGER','SCOUT','EQUIPMENT_MANAGER','TACTICAL_ANALYST',
    'FINANCE_MANAGER','ASSET_MANAGER','HR_MANAGER','FACILITY_MANAGER',
    'HR_STAFF','ASSET_STAFF','FINANCE_STAFF','FACILITY_STAFF'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $repair2$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coachingRole"    "CoachingRole";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "frontOfficeRole" "FrontOfficeRole";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamId"          INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clubId"          INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language"        TEXT NOT NULL DEFAULT 'ko';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDeleted"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isOutOfOffice"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumberId"   INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nationalityId"   INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth"     TIMESTAMP(3);

ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "countryId"         INTEGER;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "ownerEmail"         TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "businessRegNumber"  TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "companyNumber"      TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "vatNumber"          TEXT;

DO $repair3$ BEGIN
  CREATE TYPE "WageCapType" AS ENUM ('FIXED', 'RATIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $repair3$;

ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "wageCapType"  "WageCapType";
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "wageCapValue" FLOAT;
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "leagueLevel"  TEXT;
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "leagueId"     INTEGER;
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => client.query(sql))
  .then(() => { console.log('[repair-db] User table columns ensured'); })
  .catch(err => { console.error('[repair-db] Error:', err.message); })
  .finally(() => client.end());
