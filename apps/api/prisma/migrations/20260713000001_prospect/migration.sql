-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('ACTIVE', 'SIGNED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "currentTeam" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'ACTIVE',
    "convertedPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_convertedPlayerId_fkey"
    FOREIGN KEY ("convertedPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
