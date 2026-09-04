-- Add MEDICAL_PENDING to TransferRequestStatus enum
ALTER TYPE "TransferRequestStatus" ADD VALUE IF NOT EXISTS 'MEDICAL_PENDING' BEFORE 'CONFIRMED';

-- Add NegotiationType enum
DO $$ BEGIN
  CREATE TYPE "NegotiationType" AS ENUM ('CLUB_TO_CLUB', 'PLAYER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new fields to TransferRequest
ALTER TABLE "TransferRequest" ADD COLUMN IF NOT EXISTS "expectedSalary" INTEGER;
ALTER TABLE "TransferRequest" ADD COLUMN IF NOT EXISTS "medicalNotes" TEXT;
ALTER TABLE "TransferRequest" ADD COLUMN IF NOT EXISTS "registeredAt" TIMESTAMP(3);

-- Create TransferNegotiationLog table
CREATE TABLE IF NOT EXISTS "TransferNegotiationLog" (
  "id"                SERIAL PRIMARY KEY,
  "transferRequestId" INTEGER NOT NULL,
  "type"              "NegotiationType" NOT NULL,
  "note"              TEXT NOT NULL,
  "amount"            INTEGER,
  "createdById"       INTEGER NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransferNegotiationLog_transferRequestId_fkey"
    FOREIGN KEY ("transferRequestId") REFERENCES "TransferRequest"("id"),
  CONSTRAINT "TransferNegotiationLog_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
);
