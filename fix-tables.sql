CREATE TABLE IF NOT EXISTS "Club" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isLite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Team" DROP COLUMN IF EXISTS "isLite";
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "clubId" INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Team_clubId_fkey') THEN
    ALTER TABLE "Team" ADD CONSTRAINT "Team_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clubId" INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_clubId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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

CREATE TABLE IF NOT EXISTS "ClubLeague" (
  "clubId" INTEGER NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubLeague_pkey" PRIMARY KEY ("clubId", "leagueId")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClubLeague_clubId_fkey') THEN
    ALTER TABLE "ClubLeague" ADD CONSTRAINT "ClubLeague_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClubLeague_leagueId_fkey') THEN
    ALTER TABLE "ClubLeague" ADD CONSTRAINT "ClubLeague_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
