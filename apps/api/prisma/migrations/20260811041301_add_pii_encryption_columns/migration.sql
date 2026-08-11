-- AlterTable: Player — add PII encryption columns
ALTER TABLE "Player"
  ADD COLUMN "emergencyContactNameEncrypted"     TEXT,
  ADD COLUMN "emergencyContactNameIv"            TEXT,
  ADD COLUMN "emergencyContactPhoneEncrypted"    TEXT,
  ADD COLUMN "emergencyContactPhoneIv"           TEXT,
  ADD COLUMN "emergencyContactRelationEncrypted" TEXT,
  ADD COLUMN "emergencyContactRelationIv"        TEXT,
  ADD COLUMN "dateOfBirthEncrypted"              TEXT,
  ADD COLUMN "dateOfBirthIv"                     TEXT;

-- AlterTable: User — add suspendedAt
ALTER TABLE "User"
  ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- AlterTable: Injury — add retainUntil
ALTER TABLE "Injury"
  ADD COLUMN "retainUntil" TIMESTAMP(3);
