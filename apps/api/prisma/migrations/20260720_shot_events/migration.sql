-- CreateEnum
CREATE TYPE "ShotResult" AS ENUM ('GOAL', 'ON_TARGET', 'OFF_TARGET', 'BLOCKED');

-- CreateTable
CREATE TABLE "ShotEvent" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "shooterId" TEXT NOT NULL,
    "assisterId" TEXT,
    "assisterPositionOverride" TEXT,
    "xG" DOUBLE PRECISION NOT NULL,
    "result" "ShotResult" NOT NULL,
    "minute" INTEGER,

    CONSTRAINT "ShotEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShotEvent" ADD CONSTRAINT "ShotEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotEvent" ADD CONSTRAINT "ShotEvent_shooterId_fkey" FOREIGN KEY ("shooterId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotEvent" ADD CONSTRAINT "ShotEvent_assisterId_fkey" FOREIGN KEY ("assisterId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
