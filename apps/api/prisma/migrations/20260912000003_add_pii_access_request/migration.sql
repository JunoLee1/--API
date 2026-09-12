CREATE TYPE "PiiAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

CREATE TABLE "PiiAccessRequest" (
  "id"           SERIAL PRIMARY KEY,
  "targetUserId" INTEGER NOT NULL,
  "requesterId"  INTEGER NOT NULL,
  "reason"       TEXT NOT NULL,
  "status"       "PiiAccessStatus" NOT NULL DEFAULT 'PENDING',
  "grantedUntil" TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt"   TIMESTAMP(3),
  "reviewedById" INTEGER,
  CONSTRAINT "PiiAccessRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PiiAccessRequest_requesterId_fkey"  FOREIGN KEY ("requesterId")  REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PiiAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
