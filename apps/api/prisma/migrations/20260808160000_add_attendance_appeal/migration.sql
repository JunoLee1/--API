CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "AttendanceAppeal" (
  "id"               SERIAL PRIMARY KEY,
  "trainingResultId" INTEGER NOT NULL,
  "originalStatus"   "AttendanceStatus" NOT NULL,
  "requestedStatus"  "AttendanceStatus" NOT NULL,
  "reason"           TEXT NOT NULL,
  "status"           "AppealStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote"       TEXT,
  "createdById"      INTEGER NOT NULL,
  "reviewedById"     INTEGER,
  "reviewedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceAppeal_trainingResultId_fkey" FOREIGN KEY ("trainingResultId") REFERENCES "TrainingResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceAppeal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceAppeal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
