-- Add User.language (missing from previous migrations)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'ko';

-- Handle League table: old schema had (id, name, nation_id), new schema has (id, name, level, year, isActive, createdAt)
-- Drop old League structure if it doesn't have the 'year' column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'League')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'League' AND column_name = 'year') THEN
    ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_league_id_fkey";
    ALTER TABLE "Team" DROP COLUMN IF EXISTS "league_id";
    DROP TABLE "League" CASCADE;
  END IF;
END $$;

-- Create League table (new structure)
CREATE TABLE IF NOT EXISTS "League" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "level" "LeagueLevel" NOT NULL,
    "year" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "League_level_year_key" ON "League"("level", "year");

-- Create ClubLeague table
CREATE TABLE IF NOT EXISTS "ClubLeague" (
    "clubId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubLeague_pkey" PRIMARY KEY ("clubId", "leagueId")
);

-- ClubLeague FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ClubLeague_clubId_fkey') THEN
    ALTER TABLE "ClubLeague" ADD CONSTRAINT "ClubLeague_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ClubLeague_leagueId_fkey') THEN
    ALTER TABLE "ClubLeague" ADD CONSTRAINT "ClubLeague_leagueId_fkey"
      FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Add Season.leagueId FK to League
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "leagueId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Season_leagueId_fkey') THEN
    ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey"
      FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
