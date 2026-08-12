-- Add complimentaryTicketLimit to ClubSettings
ALTER TABLE "ClubSettings" ADD COLUMN "complimentaryTicketLimit" INTEGER NOT NULL DEFAULT 10;

-- Add refundedFromId to SalesRecord (self-FK)
ALTER TABLE "SalesRecord" ADD COLUMN "refundedFromId" INTEGER;
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_refundedFromId_fkey"
  FOREIGN KEY ("refundedFromId") REFERENCES "SalesRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add soldCount to SeatZone
ALTER TABLE "SeatZone" ADD COLUMN "soldCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill soldCount from existing completed non-deleted sales
UPDATE "SeatZone" sz
SET "soldCount" = COALESCE(sub.qty, 0)
FROM (
  SELECT "seatZoneId", SUM("quantity")::int AS qty
  FROM "SalesRecord"
  WHERE "seatZoneId" IS NOT NULL
    AND "status" = 'COMPLETED'
    AND "deletedAt" IS NULL
  GROUP BY "seatZoneId"
) sub
WHERE sz.id = sub."seatZoneId";
