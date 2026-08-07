CREATE TABLE "Agency" (
    "id"             SERIAL PRIMARY KEY,
    "name"           TEXT NOT NULL,
    "contactName"    TEXT,
    "phone"          TEXT,
    "email"          TEXT,
    "commissionRate" DECIMAL(5,2),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL
);

ALTER TABLE "Player"
    ADD COLUMN "agencyId"                 INTEGER,
    ADD COLUMN "emergencyContactName"     TEXT,
    ADD COLUMN "emergencyContactPhone"    TEXT,
    ADD COLUMN "emergencyContactRelation" TEXT;

ALTER TABLE "Contract"
    ADD COLUMN "agencyId"          INTEGER,
    ADD COLUMN "agencyCommission"  DECIMAL(12,2);

ALTER TABLE "Player"
    ADD CONSTRAINT "Player_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
