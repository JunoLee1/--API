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

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GM';

DO $repair4$ BEGIN
  CREATE TYPE "DeptRole" AS ENUM ('MANAGER', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $repair4$;

CREATE TABLE IF NOT EXISTS "UserDepartment" (
  "userId"       INTEGER NOT NULL,
  "departmentId" INTEGER NOT NULL,
  "role"         "DeptRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("userId", "departmentId"),
  CONSTRAINT "UserDepartment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserDepartment_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`;

const SUPER_ADMIN_HASH = '$2b$10$hzKOhKCCOJnkFxePPysHkur/nNunSDm8yoKMKVhAxpevMG9KkyhXi';

const superAdminSql = `
DO $sa$ DECLARE
  v_country_id INTEGER;
  v_phone_id   INTEGER;
BEGIN
  SELECT id INTO v_country_id FROM "Country" ORDER BY id LIMIT 1;
  IF v_country_id IS NULL THEN
    BEGIN
      INSERT INTO "Country" (name, code) VALUES ('대한민국', 'KR') RETURNING id INTO v_country_id;
    EXCEPTION WHEN others THEN
      SELECT id INTO v_country_id FROM "Country" ORDER BY id LIMIT 1;
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'superadmin@platform.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('superadmin@platform.com', '` + SUPER_ADMIN_HASH + `', 'superadmin', 'superadmin', 'SUPER_ADMIN', '1990-01-01', v_country_id, v_phone_id);
  END IF;
END $sa$;
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => client.query(sql))
  .then(() => client.query(superAdminSql))
  .then(() => { console.log('[repair-db] User table columns ensured'); })
  .catch(err => { console.error('[repair-db] Error:', err.message); })
  .finally(() => client.end());
