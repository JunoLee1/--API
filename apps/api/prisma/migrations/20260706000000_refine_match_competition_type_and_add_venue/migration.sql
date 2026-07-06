-- prisma-migrate-no-transaction
-- Rename CUP -> DOMESTIC_CUP and CHAMPIONS_LEAGUE -> CONTINENTAL in CompetitionType enum
-- Step 1: Add new enum values
ALTER TYPE "CompetitionType" ADD VALUE IF NOT EXISTS 'DOMESTIC_CUP';
ALTER TYPE "CompetitionType" ADD VALUE IF NOT EXISTS 'CONTINENTAL';
ALTER TYPE "CompetitionType" ADD VALUE IF NOT EXISTS 'PLAYOFF';

-- Step 2: Migrate existing data
UPDATE "Match" SET "competitionType" = 'DOMESTIC_CUP' WHERE "competitionType" = 'CUP';
UPDATE "Match" SET "competitionType" = 'CONTINENTAL' WHERE "competitionType" = 'CHAMPIONS_LEAGUE';
UPDATE "BonusTrigger" SET "competitionType" = 'DOMESTIC_CUP' WHERE "competitionType" = 'CUP';
UPDATE "BonusTrigger" SET "competitionType" = 'CONTINENTAL' WHERE "competitionType" = 'CHAMPIONS_LEAGUE';

-- Step 3: Create Venue enum
CREATE TYPE "Venue" AS ENUM ('HOME', 'AWAY', 'NEUTRAL');

-- Step 4: Add venue column to Match (nullable for backward compatibility)
ALTER TABLE "Match" ADD COLUMN "venue" "Venue";

-- Note: Removing old enum values (CUP, CHAMPIONS_LEAGUE) from CompetitionType
-- requires recreating the enum type in PostgreSQL. This is handled via a rename approach:
-- 1. Rename old type
ALTER TYPE "CompetitionType" RENAME TO "CompetitionType_old";

-- 2. Create new type with correct values
CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'DOMESTIC_CUP', 'CONTINENTAL', 'PLAYOFF', 'FRIENDLY');

-- 3. Update columns to use new type
ALTER TABLE "Match" ALTER COLUMN "competitionType" TYPE "CompetitionType" USING "competitionType"::text::"CompetitionType";
ALTER TABLE "BonusTrigger" ALTER COLUMN "competitionType" TYPE "CompetitionType" USING "competitionType"::text::"CompetitionType";

-- 4. Drop old type
DROP TYPE "CompetitionType_old";
