CREATE TYPE "LoadUnit" AS ENUM ('KG', 'MINUTES', 'DISTANCE_M', 'SETS');

ALTER TABLE "TrainingLoad"
  ADD COLUMN IF NOT EXISTS "loadUnit" "LoadUnit";
