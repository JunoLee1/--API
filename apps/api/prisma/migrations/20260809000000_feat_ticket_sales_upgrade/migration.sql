-- CreateEnum
CREATE TYPE "SalesRecordStatus" AS ENUM ('COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('ONLINE', 'ONSITE', 'PARTNER', 'SEASON_PASS');

-- AlterTable: SeatZone
ALTER TABLE "SeatZone" ADD COLUMN "unitPrice" INTEGER;

-- AlterTable: SalesRecord
ALTER TABLE "SalesRecord" ADD COLUMN "seatZoneId" INTEGER,
ADD COLUMN "status" "SalesRecordStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "channel" "SalesChannel";

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_seatZoneId_fkey" FOREIGN KEY ("seatZoneId") REFERENCES "SeatZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
