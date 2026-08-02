-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('SARAMIN', 'GLASSDOOR', 'INDEED', 'DIRECT');

-- CreateEnum
CREATE TYPE "LeagueLevel" AS ENUM ('K3', 'K_LEAGUE_2', 'K_LEAGUE_1', 'EPL', 'OTHER');

-- CreateEnum
CREATE TYPE "DepartmentCategory" AS ENUM ('COMPLIANCE', 'PERFORMANCE', 'FINANCE', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PROFESSIONAL', 'SEMI_PROFESSIONAL');

-- CreateEnum
CREATE TYPE "FacilityZone" AS ENUM ('GROUND', 'MECHANICAL', 'STRUCTURAL', 'SAFETY', 'SANITATION', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('OK', 'ISSUE_FOUND');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('EMERGENCY', 'HIGH', 'NORMAL');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SponsorType" AS ENUM ('TITLE', 'KIT', 'STADIUM_NAMING', 'DIGITAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentSchedule" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SponsorshipPaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PayrollCountry" AS ENUM ('KR', 'UK');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- AlterEnum
ALTER TYPE "FrontOfficeRole" ADD VALUE 'FACILITY_MANAGER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FACILITY_EMERGENCY';
ALTER TYPE "NotificationType" ADD VALUE 'FACILITY_MAINTENANCE_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYROLL_CONFIRMED';

-- AlterEnum
ALTER TYPE "TeamType" ADD VALUE 'B_TEAM';

-- AlterEnum
BEGIN;
CREATE TYPE "TransferType_new" AS ENUM ('PERMANENT_IN', 'PERMANENT_OUT', 'LOAN_OUT', 'LOAN_IN', 'FREE', 'RELEASE');
ALTER TABLE "Transfer" ALTER COLUMN "type" TYPE "TransferType_new" USING ("type"::text::"TransferType_new");
ALTER TYPE "TransferType" RENAME TO "TransferType_old";
ALTER TYPE "TransferType_new" RENAME TO "TransferType";
DROP TYPE "public"."TransferType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "BudgetOverrideLog" DROP CONSTRAINT "BudgetOverrideLog_createdById_fkey";

-- DropForeignKey
ALTER TABLE "OperatingExpense" DROP CONSTRAINT "OperatingExpense_createdById_fkey";

-- DropForeignKey
ALTER TABLE "OperatingExpense" DROP CONSTRAINT "OperatingExpense_seasonId_fkey";

-- AlterTable
ALTER TABLE "BudgetCategoryPlan" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BudgetTier" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "contractType" "ContractType" NOT NULL DEFAULT 'PROFESSIONAL';

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "category" "DepartmentCategory",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinancialReport" ALTER COLUMN "contingencyReserve" DROP NOT NULL;

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "externalApplicantId" TEXT,
ADD COLUMN     "source" "ApplicationSource";

-- AlterTable
ALTER TABLE "OperatingExpense" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "leagueLevel" "LeagueLevel";

-- CreateTable
CREATE TABLE "LeagueLevelWeightConfig" (
    "id" SERIAL NOT NULL,
    "leagueLevel" "LeagueLevel" NOT NULL,
    "category" "DepartmentCategory" NOT NULL,
    "weight" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueLevelWeightConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentIbiConfig" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "coreTaskRatio" DECIMAL(4,3) NOT NULL,
    "replacementDays" INTEGER NOT NULL,
    "backupHeadcount" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentIbiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonComplianceCheck" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "afcQualificationMet" BOOLEAN NOT NULL DEFAULT false,
    "officeStaffCountMet" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDeadline" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "deadlineDate" TIMESTAMP(3) NOT NULL,
    "triggerDaysBefore" INTEGER NOT NULL,
    "betaMultiplier" DECIMAL(4,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityInspection" (
    "id" SERIAL NOT NULL,
    "type" "InspectionType" NOT NULL,
    "facilityZone" "FacilityZone" NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "certificateUrl" TEXT,
    "statutoryDeadline" TIMESTAMP(3),
    "inspectedById" INTEGER NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "sourceInspectionId" INTEGER,
    "postIncidentReport" TEXT,
    "estimatedCost" DECIMAL(12,2),
    "actualCost" DECIMAL(12,2),
    "resolvedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsorship" (
    "id" SERIAL NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "type" "SponsorType" NOT NULL,
    "totalFee" DECIMAL(14,2) NOT NULL,
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3) NOT NULL,
    "paymentSchedule" "PaymentSchedule" NOT NULL,
    "attachedContractId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorshipPayment" (
    "id" SERIAL NOT NULL,
    "sponsorshipId" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "SponsorshipPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorshipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollConfig" (
    "id" SERIAL NOT NULL,
    "country" "PayrollCountry" NOT NULL,
    "insuranceType" TEXT NOT NULL,
    "employeeRate" DECIMAL(6,5) NOT NULL,
    "employerRate" DECIMAL(6,5) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSalary" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "staffRecordId" INTEGER,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "country" "PayrollCountry" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAllowance" (
    "id" SERIAL NOT NULL,
    "staffSalaryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" SERIAL NOT NULL,
    "staffSalaryId" INTEGER NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "grossPay" DECIMAL(12,2) NOT NULL,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "netPay" DECIMAL(12,2) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedById" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueLevelWeightConfig_leagueLevel_category_key" ON "LeagueLevelWeightConfig"("leagueLevel", "category");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentIbiConfig_departmentId_jobTitle_effectiveFrom_key" ON "DepartmentIbiConfig"("departmentId", "jobTitle", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonComplianceCheck_seasonId_key" ON "SeasonComplianceCheck"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollConfig_country_insuranceType_effectiveFrom_key" ON "PayrollConfig"("country", "insuranceType", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_staffSalaryId_month_key" ON "PayrollRun"("staffSalaryId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_postingId_externalApplicantId_key" ON "JobApplication"("postingId", "externalApplicantId");

-- AddForeignKey
ALTER TABLE "BudgetOverrideLog" ADD CONSTRAINT "BudgetOverrideLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentIbiConfig" ADD CONSTRAINT "DepartmentIbiConfig_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonComplianceCheck" ADD CONSTRAINT "SeasonComplianceCheck_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityInspection" ADD CONSTRAINT "FacilityInspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_sourceInspectionId_fkey" FOREIGN KEY ("sourceInspectionId") REFERENCES "FacilityInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_attachedContractId_fkey" FOREIGN KEY ("attachedContractId") REFERENCES "PartnerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorshipPayment" ADD CONSTRAINT "SponsorshipPayment_sponsorshipId_fkey" FOREIGN KEY ("sponsorshipId") REFERENCES "Sponsorship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalary" ADD CONSTRAINT "StaffSalary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalary" ADD CONSTRAINT "StaffSalary_staffRecordId_fkey" FOREIGN KEY ("staffRecordId") REFERENCES "StaffRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAllowance" ADD CONSTRAINT "StaffAllowance_staffSalaryId_fkey" FOREIGN KEY ("staffSalaryId") REFERENCES "StaffSalary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_staffSalaryId_fkey" FOREIGN KEY ("staffSalaryId") REFERENCES "StaffSalary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

