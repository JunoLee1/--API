-- AlterTable: add clubId to TrainingSession
ALTER TABLE "public"."TrainingSession" ADD COLUMN "clubId" INTEGER;

-- AlterTable: add clubId to OperatingExpense
ALTER TABLE "public"."OperatingExpense" ADD COLUMN "clubId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."TrainingSession" ADD CONSTRAINT "TrainingSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OperatingExpense" ADD CONSTRAINT "OperatingExpense_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TrainingSession: backfill clubId from Team.clubId
UPDATE "public"."TrainingSession" ts
SET "clubId" = t."clubId"
FROM "public"."Team" t
WHERE ts."teamId" = t."id" AND t."clubId" IS NOT NULL;

-- OperatingExpense: backfill clubId from User.clubId
UPDATE "public"."OperatingExpense" oe
SET "clubId" = u."clubId"
FROM "public"."User" u
WHERE oe."createdById" = u."id" AND u."clubId" IS NOT NULL;
