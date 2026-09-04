-- Prospect: add medicalNotes field
ALTER TABLE "Prospect" ADD COLUMN IF NOT EXISTS "medicalNotes" TEXT;

-- Player: add prospectId reverse FK
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "prospectId" INTEGER;

-- ProspectNegotiationLog table
CREATE TABLE IF NOT EXISTS "ProspectNegotiationLog" (
  "id"          SERIAL PRIMARY KEY,
  "prospectId"  INTEGER NOT NULL REFERENCES "Prospect"("id"),
  "type"        "NegotiationType" NOT NULL,
  "note"        TEXT NOT NULL,
  "amount"      INTEGER,
  "createdById" INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
