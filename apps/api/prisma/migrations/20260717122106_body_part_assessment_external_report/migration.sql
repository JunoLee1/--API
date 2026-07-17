-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('HEAD_FACE', 'NECK_SHOULDER', 'TORSO_BACK', 'THIGH_FRONT', 'THIGH_BACK', 'KNEE', 'SHIN_CALF', 'ANKLE', 'FOOT_TOE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExternalReportTarget" AS ENUM ('EDUCATION_OFFICE', 'SCHOOL_SAFETY', 'LEAGUE', 'FEDERATION', 'INSURANCE');

-- CreateEnum
CREATE TYPE "ExternalReportStatus" AS ENUM ('PENDING_SUBMISSION', 'SUBMITTED', 'SUPPLEMENT_REQUESTED', 'COMPLETED');

-- AlterTable: convert bodyPart String -> BodyPart enum (existing rows become OTHER)
ALTER TABLE "Injury" ALTER COLUMN "bodyPart" TYPE "BodyPart" USING 'OTHER'::"BodyPart";

-- CreateTable
CREATE TABLE "InjuryAssessment" (
    "id" SERIAL NOT NULL,
    "injuryId" INTEGER NOT NULL,
    "painLevel" INTEGER NOT NULL,
    "hasSwelling" BOOLEAN NOT NULL DEFAULT false,
    "romScore" INTEGER NOT NULL,
    "strengthScore" INTEGER NOT NULL,
    "sprintScore" INTEGER NOT NULL,
    "jumpScore" INTEGER NOT NULL,
    "psychScore" INTEGER NOT NULL,
    "positionRiskScore" INTEGER NOT NULL,
    "medicalScore" DOUBLE PRECISION NOT NULL,
    "functionalScore" DOUBLE PRECISION NOT NULL,
    "modifierScore" DOUBLE PRECISION NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedById" INTEGER NOT NULL,

    CONSTRAINT "InjuryAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalReport" (
    "id" SERIAL NOT NULL,
    "injuryId" INTEGER NOT NULL,
    "target" "ExternalReportTarget" NOT NULL,
    "status" "ExternalReportStatus" NOT NULL DEFAULT 'PENDING_SUBMISSION',
    "reportData" JSONB NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InjuryAssessment_injuryId_key" ON "InjuryAssessment"("injuryId");

-- AddForeignKey
ALTER TABLE "InjuryAssessment" ADD CONSTRAINT "InjuryAssessment_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryAssessment" ADD CONSTRAINT "InjuryAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReport" ADD CONSTRAINT "ExternalReport_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE CASCADE ON UPDATE CASCADE;
