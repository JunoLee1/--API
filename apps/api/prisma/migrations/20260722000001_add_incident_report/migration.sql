-- CreateEnum
CREATE TYPE "IncidentReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SIGNED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('MATCH', 'TRAINING');

-- AlterTable: ExternalReport injuryId optional, add incidentReportId
ALTER TABLE "ExternalReport" ALTER COLUMN "injuryId" DROP NOT NULL;
ALTER TABLE "ExternalReport" ADD COLUMN "incidentReportId" INTEGER;

-- CreateTable: IncidentReport
CREATE TABLE "IncidentReport" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "type" "IncidentType" NOT NULL,
    "matchId" INTEGER,
    "sessionId" INTEGER,
    "description" TEXT NOT NULL,
    "reportedById" INTEGER NOT NULL,
    "supervisorSigned" BOOLEAN NOT NULL DEFAULT false,
    "medicalSigned" BOOLEAN NOT NULL DEFAULT false,
    "injuryId" INTEGER,
    "status" "IncidentReportStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ExternalReport FK for incidentReportId
ALTER TABLE "ExternalReport" ADD CONSTRAINT "ExternalReport_incidentReportId_fkey" FOREIGN KEY ("incidentReportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UniqueConstraint: ExternalReport incidentReportId
CREATE UNIQUE INDEX "ExternalReport_incidentReportId_target_key" ON "ExternalReport"("incidentReportId", "target");
