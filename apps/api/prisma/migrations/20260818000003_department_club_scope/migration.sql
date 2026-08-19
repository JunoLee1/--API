-- Drop old unique constraint on name
ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_name_key";

-- Add clubId column
ALTER TABLE "Department" ADD COLUMN "clubId" INTEGER;

-- Add FK
ALTER TABLE "Department" ADD CONSTRAINT "Department_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New unique: (name, clubId)
CREATE UNIQUE INDEX "Department_name_clubId_key" ON "Department"("name", "clubId");
