-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GUARDIAN';

-- CreateEnum
CREATE TYPE "YouthRegistrationStatus" AS ENUM ('PENDING', 'GUARDIAN_APPROVED', 'CONTRACTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "guardianId" INTEGER;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "YouthRegistration" (
    "id" SERIAL NOT NULL,
    "playerName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "preferredJerseyNumber" INTEGER,
    "teamId" INTEGER NOT NULL,
    "guardianId" INTEGER,
    "status" "YouthRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" INTEGER NOT NULL,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouthRegistration_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "YouthRegistration" ADD CONSTRAINT "YouthRegistration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouthRegistration" ADD CONSTRAINT "YouthRegistration_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouthRegistration" ADD CONSTRAINT "YouthRegistration_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'YOUTH_REGISTRATION_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'YOUTH_WEEKLY_SCHEDULE';
ALTER TYPE "NotificationType" ADD VALUE 'YOUTH_SESSION_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_REPORT_SUBMITTED';
