-- CreateEnum
CREATE TYPE "RehabStage" AS ENUM ('INITIAL_TREATMENT', 'ACUTE_TREATMENT', 'REHABILITATION', 'RETURN_TRAINING', 'CLEARED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SecurityLevel" AS ENUM ('INTERNAL', 'MEDICAL', 'PRIVATE');

-- CreateTable
CREATE TABLE "InjuryReport" (
    "id" SERIAL NOT NULL,
    "injuryId" INTEGER NOT NULL,
    "diagnosisName" TEXT,
    "treatmentContent" TEXT,
    "rehabStage" "RehabStage",
    "trainingReturnDate" TIMESTAMP(3),
    "matchAvailable" BOOLEAN,
    "reinjuryRisk" "RiskLevel",
    "medicalOpinion" TEXT,
    "securityLevel" "SecurityLevel" NOT NULL DEFAULT 'INTERNAL',
    "coachSignedAt" TIMESTAMP(3),
    "coachSignedById" INTEGER,
    "trainerSignedAt" TIMESTAMP(3),
    "trainerSignedById" INTEGER,
    "medicalSignedAt" TIMESTAMP(3),
    "medicalSignedById" INTEGER,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InjuryReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InjuryReport_injuryId_key" ON "InjuryReport"("injuryId");

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_coachSignedById_fkey" FOREIGN KEY ("coachSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_trainerSignedById_fkey" FOREIGN KEY ("trainerSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryReport" ADD CONSTRAINT "InjuryReport_medicalSignedById_fkey" FOREIGN KEY ("medicalSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
