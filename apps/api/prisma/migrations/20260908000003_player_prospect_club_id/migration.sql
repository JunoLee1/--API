-- Player.clubId 추가 및 backfill
ALTER TABLE "public"."Player" ADD COLUMN "clubId" INTEGER;
ALTER TABLE "public"."Player"
  ADD CONSTRAINT "Player_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "public"."Player" p
SET "clubId" = t."clubId"
FROM "public"."Team" t
WHERE p."teamId" = t."id" AND t."clubId" IS NOT NULL;

-- Prospect.clubId 추가 및 backfill (첫 번째 Club으로 일괄)
ALTER TABLE "public"."Prospect" ADD COLUMN "clubId" INTEGER;
ALTER TABLE "public"."Prospect"
  ADD CONSTRAINT "Prospect_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "public"."Prospect"
SET "clubId" = (SELECT "id" FROM "public"."Club" ORDER BY "id" LIMIT 1)
WHERE "clubId" IS NULL;
