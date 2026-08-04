-- Add GM to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GM';

-- Remove GM from FrontOfficeRole enum (requires recreating the enum in PostgreSQL)
ALTER TYPE "FrontOfficeRole" RENAME TO "FrontOfficeRole_old";
CREATE TYPE "FrontOfficeRole" AS ENUM ('TD', 'CONTRACT_MANAGER', 'SCOUT', 'EQUIPMENT_MANAGER', 'TACTICAL_ANALYST', 'FINANCE_MANAGER', 'ASSET_MANAGER', 'HR_MANAGER', 'FACILITY_MANAGER', 'HR_STAFF', 'ASSET_STAFF', 'FINANCE_STAFF', 'FACILITY_STAFF');
ALTER TABLE "User" ALTER COLUMN "frontOfficeRole" TYPE "FrontOfficeRole" USING "frontOfficeRole"::text::"FrontOfficeRole";
DROP TYPE "FrontOfficeRole_old";

-- CreateTable Club
CREATE TABLE "Club" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- AlterTable Team: drop isLite, add clubId
ALTER TABLE "Team" DROP COLUMN IF EXISTS "isLite";
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "clubId" INTEGER;

-- AlterTable User: add clubId
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clubId" INTEGER;

-- AddForeignKey Team.clubId -> Club.id
ALTER TABLE "Team" ADD CONSTRAINT "Team_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey User.clubId -> Club.id
ALTER TABLE "User" ADD CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
