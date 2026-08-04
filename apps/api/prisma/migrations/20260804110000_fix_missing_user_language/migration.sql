-- Fix missing User.language column on production DB
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'ko';

-- Ensure LeagueLevel type exists
DO $$ BEGIN
  CREATE TYPE "LeagueLevel" AS ENUM ('K3', 'K_LEAGUE_2', 'K_LEAGUE_1', 'EPL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop old League table (nation_id structure) and create new (level/year structure)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'League')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'League' AND column_name = 'year') THEN
    ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_league_id_fkey";
    ALTER TABLE "Team" DROP COLUMN IF EXISTS "league_id";
    DROP TABLE "League" CASCADE;
  END IF;
END $$;

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

-- ClubLeague (only if Club table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Club') THEN
    CREATE TABLE IF NOT EXISTS "ClubLeague" (
      "clubId" INTEGER NOT NULL,
      "leagueId" INTEGER NOT NULL,
      "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClubLeague_pkey" PRIMARY KEY ("clubId", "leagueId")
    );
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClubLeague_clubId_fkey') THEN
      ALTER TABLE "ClubLeague" ADD CONSTRAINT "ClubLeague_clubId_fkey"
        FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClubLeague_leagueId_fkey') THEN
      ALTER TABLE "ClubLeague" ADD CONSTRAINT "ClubLeague_leagueId_fkey"
        FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- Season.leagueId
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "leagueId" INTEGER;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Season_leagueId_fkey') THEN
    ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey"
      FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
