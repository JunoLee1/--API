// Emergency repair: adds missing User columns regardless of Prisma migration state.
// Runs once on container startup, before prisma migrate deploy.
const { Client } = require('pg');

const sql = `
DO $repair$ BEGIN
  CREATE TYPE "CoachingRole" AS ENUM (
    'HEAD_COACH','ASSISTANT_COACH','DEFENSIVE_COACH','ATTACKING_COACH',
    'PHYSICAL_COACH','SET_PIECE_COACH','GOALKEEPER_COACH','MEDICAL','MEDICAL_DIRECTOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $repair$;

DO $repair2$ BEGIN
  CREATE TYPE "FrontOfficeRole" AS ENUM (
    'TD','CONTRACT_MANAGER','SCOUT','EQUIPMENT_MANAGER','TACTICAL_ANALYST',
    'FINANCE_MANAGER','ASSET_MANAGER','HR_MANAGER','FACILITY_MANAGER',
    'HR_STAFF','ASSET_STAFF','FINANCE_STAFF','FACILITY_STAFF'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $repair2$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coachingRole"    "CoachingRole";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "frontOfficeRole" "FrontOfficeRole";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamId"          INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clubId"          INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language"        TEXT NOT NULL DEFAULT 'ko';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDeleted"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isOutOfOffice"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumberId"   INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nationalityId"   INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth"     TIMESTAMP(3);

ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "countryId"         INTEGER;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "ownerEmail"         TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "businessRegNumber"  TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "companyNumber"      TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "vatNumber"          TEXT;

DO $repair3$ BEGIN
  CREATE TYPE "WageCapType" AS ENUM ('FIXED', 'RATIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $repair3$;

ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "wageCapType"  "WageCapType";
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "wageCapValue" FLOAT;
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "leagueLevel"  TEXT;
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "leagueId"     INTEGER;

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GM';

DO $repair4$ BEGIN
  CREATE TYPE "DeptRole" AS ENUM ('MANAGER', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $repair4$;

CREATE TABLE IF NOT EXISTS "UserDepartment" (
  "userId"       INTEGER NOT NULL,
  "departmentId" INTEGER NOT NULL,
  "role"         "DeptRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("userId", "departmentId"),
  CONSTRAINT "UserDepartment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserDepartment_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`;

const SUPER_ADMIN_HASH = '$2b$10$hzKOhKCCOJnkFxePPysHkur/nNunSDm8yoKMKVhAxpevMG9KkyhXi';

const superAdminSql = `
DO $sa$ DECLARE
  v_country_id INTEGER;
  v_phone_id   INTEGER;
BEGIN
  SELECT id INTO v_country_id FROM "Country" ORDER BY id LIMIT 1;
  IF v_country_id IS NULL THEN
    BEGIN
      INSERT INTO "Country" (name, code) VALUES ('대한민국', 'KR') RETURNING id INTO v_country_id;
    EXCEPTION WHEN others THEN
      SELECT id INTO v_country_id FROM "Country" ORDER BY id LIMIT 1;
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'superadmin@platform.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('superadmin@platform.com', '` + SUPER_ADMIN_HASH + `', 'superadmin', 'superadmin', 'SUPER_ADMIN', '1990-01-01', v_country_id, v_phone_id);
  END IF;
END $sa$;
`;

const HASH = '$2b$10$hzKOhKCCOJnkFxePPysHkur/nNunSDm8yoKMKVhAxpevMG9KkyhXi';

const staffSql = `
DO $staff$ DECLARE
  v_country_id INTEGER;
  v_club_id    INTEGER;
  v_phone_id   INTEGER;
BEGIN
  SELECT id INTO v_country_id FROM "Country" ORDER BY id LIMIT 1;
  SELECT id INTO v_club_id FROM "Club" ORDER BY id LIMIT 1;
  IF v_country_id IS NULL OR v_club_id IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'hr@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_hr_mgr', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('hr@club.com', '${HASH}', 'HR매니저', 'hr_manager', 'FRONT_OFFICE', 'HR_MANAGER', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'hr.staff@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_hr_staff', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('hr.staff@club.com', '${HASH}', 'HR직원', 'hr_staff', 'FRONT_OFFICE', 'HR_STAFF', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'asset.staff@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_asset_staff', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('asset.staff@club.com', '${HASH}', '자산관리직원', 'asset_staff', 'FRONT_OFFICE', 'ASSET_STAFF', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'finance.staff@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_finance_staff', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('finance.staff@club.com', '${HASH}', '재무직원', 'finance_staff', 'FRONT_OFFICE', 'FINANCE_STAFF', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'facility.manager@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_fac_mgr', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('facility.manager@club.com', '${HASH}', '시설관리팀장', 'facility_manager', 'FRONT_OFFICE', 'FACILITY_MANAGER', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'facility.staff@club.com') THEN
    INSERT INTO "PhoneNumber" (encrypted, iv) VALUES ('dummy_fac_staff', 'dummy') RETURNING id INTO v_phone_id;
    INSERT INTO "User" (email, password, username, nickname, role, "frontOfficeRole", "clubId", "dateOfBirth", "nationalityId", "phoneNumberId")
    VALUES ('facility.staff@club.com', '${HASH}', '시설관리직원', 'facility_staff', 'FRONT_OFFICE', 'FACILITY_STAFF', v_club_id, '1990-01-01', v_country_id, v_phone_id);
  END IF;
END $staff$;
`;

const repairSql2 = `
DO $r$ BEGIN CREATE TYPE "MealExpenseType" AS ENUM ('TRAINING', 'MATCH'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "DepartmentCategory" AS ENUM ('COMPLIANCE', 'PERFORMANCE', 'FINANCE', 'OPERATIONS'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "LeagueLevel" AS ENUM ('K3', 'K_LEAGUE_2', 'K_LEAGUE_1', 'EPL', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "ApplicationSource" AS ENUM ('SARAMIN', 'GLASSDOOR', 'INDEED', 'DIRECT'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "ContractType" AS ENUM ('PROFESSIONAL', 'SEMI_PROFESSIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "FacilityZone" AS ENUM ('GROUND', 'MECHANICAL', 'STRUCTURAL', 'SAFETY', 'SANITATION', 'OPERATIONS'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "InspectionType" AS ENUM ('DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "InspectionResult" AS ENUM ('OK', 'ISSUE_FOUND'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "MaintenancePriority" AS ENUM ('EMERGENCY', 'HIGH', 'NORMAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "SponsorType" AS ENUM ('TITLE', 'KIT', 'STADIUM_NAMING', 'DIGITAL', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "PaymentSchedule" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "SponsorshipPaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "PayrollCountry" AS ENUM ('KR', 'UK'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CONFIRMED'); EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

ALTER TYPE "FrontOfficeRole" ADD VALUE IF NOT EXISTS 'FINANCE_MANAGER';
ALTER TYPE "FrontOfficeRole" ADD VALUE IF NOT EXISTS 'ASSET_MANAGER';
ALTER TYPE "FrontOfficeRole" ADD VALUE IF NOT EXISTS 'FACILITY_MANAGER';
ALTER TYPE "FrontOfficeRole" ADD VALUE IF NOT EXISTS 'HR_STAFF';
ALTER TYPE "FrontOfficeRole" ADD VALUE IF NOT EXISTS 'ASSET_STAFF';
ALTER TYPE "FrontOfficeRole" ADD VALUE IF NOT EXISTS 'FINANCE_STAFF';
ALTER TYPE "FrontOfficeRole" ADD VALUE IF NOT EXISTS 'FACILITY_STAFF';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FACILITY_EMERGENCY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FACILITY_MAINTENANCE_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYROLL_CONFIRMED';
ALTER TYPE "TeamType" ADD VALUE IF NOT EXISTS 'B_TEAM';

ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "foodPreferences" TEXT;

CREATE TABLE IF NOT EXISTS "ClubSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "currency" TEXT NOT NULL DEFAULT 'KRW',
  CONSTRAINT "ClubSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StaffRecord" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "departmentId" INTEGER,
  "phone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffRecord_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StaffRecord" ADD COLUMN IF NOT EXISTS "departmentId" INTEGER;
ALTER TABLE "StaffRecord" DROP COLUMN IF EXISTS "department";

CREATE TABLE IF NOT EXISTS "MealExpense" (
  "id" SERIAL NOT NULL,
  "type" "MealExpenseType" NOT NULL,
  "sessionId" INTEGER,
  "matchId" INTEGER,
  "date" TIMESTAMP(3) NOT NULL,
  "amount" INTEGER NOT NULL,
  "restaurantName" TEXT,
  "note" TEXT,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Department" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "parentId" INTEGER,
  "headId" INTEGER,
  "category" "DepartmentCategory",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "parentId" INTEGER;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "headId" INTEGER;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "category" "DepartmentCategory";

DO $r$ BEGIN ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "leagueLevel" "LeagueLevel";
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "contractType" "ContractType" NOT NULL DEFAULT 'PROFESSIONAL';
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "externalApplicantId" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "source" "ApplicationSource";

CREATE TABLE IF NOT EXISTS "LeagueLevelWeightConfig" (
  "id" SERIAL NOT NULL,
  "leagueLevel" "LeagueLevel" NOT NULL,
  "category" "DepartmentCategory" NOT NULL,
  "weight" DECIMAL(5,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeagueLevelWeightConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeagueLevelWeightConfig_leagueLevel_category_key" ON "LeagueLevelWeightConfig"("leagueLevel", "category");

CREATE TABLE IF NOT EXISTS "DepartmentIbiConfig" (
  "id" SERIAL NOT NULL,
  "departmentId" INTEGER NOT NULL,
  "jobTitle" TEXT NOT NULL,
  "coreTaskRatio" DECIMAL(4,3) NOT NULL,
  "replacementDays" INTEGER NOT NULL,
  "backupHeadcount" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentIbiConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentIbiConfig_departmentId_jobTitle_effectiveFrom_key" ON "DepartmentIbiConfig"("departmentId", "jobTitle", "effectiveFrom");
DO $r$ BEGIN ALTER TABLE "DepartmentIbiConfig" ADD CONSTRAINT "DepartmentIbiConfig_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

CREATE TABLE IF NOT EXISTS "SeasonComplianceCheck" (
  "id" SERIAL NOT NULL,
  "seasonId" INTEGER NOT NULL,
  "afcQualificationMet" BOOLEAN NOT NULL DEFAULT false,
  "officeStaffCountMet" BOOLEAN NOT NULL DEFAULT false,
  "checkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonComplianceCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SeasonComplianceCheck_seasonId_key" ON "SeasonComplianceCheck"("seasonId");
DO $r$ BEGIN ALTER TABLE "SeasonComplianceCheck" ADD CONSTRAINT "SeasonComplianceCheck_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

CREATE TABLE IF NOT EXISTS "ComplianceDeadline" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "deadlineDate" TIMESTAMP(3) NOT NULL,
  "triggerDaysBefore" INTEGER NOT NULL,
  "betaMultiplier" DECIMAL(4,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceDeadline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FacilityInspection" (
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
DO $r$ BEGIN ALTER TABLE "FacilityInspection" ADD CONSTRAINT "FacilityInspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

CREATE TABLE IF NOT EXISTS "MaintenanceRequest" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);
DO $r$ BEGIN ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_sourceInspectionId_fkey" FOREIGN KEY ("sourceInspectionId") REFERENCES "FacilityInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

CREATE TABLE IF NOT EXISTS "Sponsorship" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sponsorship_pkey" PRIMARY KEY ("id")
);
DO $r$ BEGIN ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_attachedContractId_fkey" FOREIGN KEY ("attachedContractId") REFERENCES "PartnerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

CREATE TABLE IF NOT EXISTS "SponsorshipPayment" (
  "id" SERIAL NOT NULL,
  "sponsorshipId" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "status" "SponsorshipPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SponsorshipPayment_pkey" PRIMARY KEY ("id")
);
DO $r$ BEGIN ALTER TABLE "SponsorshipPayment" ADD CONSTRAINT "SponsorshipPayment_sponsorshipId_fkey" FOREIGN KEY ("sponsorshipId") REFERENCES "Sponsorship"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

CREATE TABLE IF NOT EXISTS "PayrollConfig" (
  "id" SERIAL NOT NULL,
  "country" "PayrollCountry" NOT NULL,
  "insuranceType" TEXT NOT NULL,
  "employeeRate" DECIMAL(6,5) NOT NULL,
  "employerRate" DECIMAL(6,5) NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollConfig_country_insuranceType_effectiveFrom_key" ON "PayrollConfig"("country", "insuranceType", "effectiveFrom");

CREATE TABLE IF NOT EXISTS "StaffSalary" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER,
  "staffRecordId" INTEGER,
  "baseSalary" DECIMAL(12,2) NOT NULL,
  "country" "PayrollCountry" NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffSalary_pkey" PRIMARY KEY ("id")
);
DO $r$ BEGIN ALTER TABLE "StaffSalary" ADD CONSTRAINT "StaffSalary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "StaffSalary" ADD CONSTRAINT "StaffSalary_staffRecordId_fkey" FOREIGN KEY ("staffRecordId") REFERENCES "StaffRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

CREATE TABLE IF NOT EXISTS "StaffAllowance" (
  "id" SERIAL NOT NULL,
  "staffSalaryId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "taxable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffAllowance_pkey" PRIMARY KEY ("id")
);
DO $r$ BEGIN ALTER TABLE "StaffAllowance" ADD CONSTRAINT "StaffAllowance_staffSalaryId_fkey" FOREIGN KEY ("staffSalaryId") REFERENCES "StaffSalary"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;

CREATE TABLE IF NOT EXISTS "PayrollRun" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_staffSalaryId_month_key" ON "PayrollRun"("staffSalaryId", "month");
DO $r$ BEGIN ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_staffSalaryId_fkey" FOREIGN KEY ("staffSalaryId") REFERENCES "StaffSalary"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  const run = (q, label) => client.query(q).catch(e => console.error(`[repair-db] ${label}:`, e.message));
  await client.connect();
  try {
    await run(sql, 'sql');
    await run(repairSql2, 'repairSql2');
    await run(superAdminSql, 'superAdminSql');
    await run(staffSql, 'staffSql');
    console.log('[repair-db] done');
  } catch (e) {
    console.error('[repair-db] fatal:', e.message);
  } finally {
    await client.end();
  }
}
main();
