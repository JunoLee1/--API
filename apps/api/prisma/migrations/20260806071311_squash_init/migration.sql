-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPER_ADMIN', 'GM', 'FRONT_OFFICE', 'COACHING_STAFF', 'PLAYER', 'AGENT', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "YouthRegistrationStatus" AS ENUM ('PENDING', 'GUARDIAN_APPROVED', 'CONTRACTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IncidentReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SIGNED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('MATCH', 'TRAINING');

-- CreateEnum
CREATE TYPE "CoachingRole" AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH', 'ATTACKING_COACH', 'PHYSICAL_COACH', 'SET_PIECE_COACH', 'GOALKEEPER_COACH', 'MEDICAL', 'MEDICAL_DIRECTOR');

-- CreateEnum
CREATE TYPE "FrontOfficeRole" AS ENUM ('TD', 'CONTRACT_MANAGER', 'SCOUT', 'EQUIPMENT_MANAGER', 'TACTICAL_ANALYST', 'FINANCE_MANAGER', 'ASSET_MANAGER', 'HR_MANAGER', 'FACILITY_MANAGER', 'HR_STAFF', 'ASSET_STAFF', 'FINANCE_STAFF', 'FACILITY_STAFF');

-- CreateEnum
CREATE TYPE "PlayerLevel" AS ENUM ('YOUTH', 'ROOKIE', 'SENIOR', 'VETERAN');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'ON_LOAN', 'RELEASED', 'RETIRED');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GOALKEEPER', 'STRIKER', 'SHADOW_STRIKER', 'WINGER', 'CENTRAL_ATTACK_MIDFIELDER', 'RIGHT_ATTACK_MIDFIELDER', 'LEFT_ATTACK_MIDFIELDER', 'CENTRAL_DEFENSIVE_MIDFIELDER', 'LEFT_DEFENSIVE_MIDFIELDER', 'RIGHT_DEFENSIVE_MIDFIELDER', 'CENTER_BACK', 'LEFT_WING_BACK', 'LEFT_FULL_BACK', 'RIGHT_WING_BACK', 'RIGHT_FULL_BACK');

-- CreateEnum
CREATE TYPE "Foot" AS ENUM ('LEFT', 'RIGHT', 'BOTH');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "BonusMetric" AS ENUM ('GOALS', 'ASSISTS', 'APPEARANCES', 'CLEAN_SHEETS', 'SAVES', 'PASS_ACCURACY', 'TACKLE_SUCCESS_RATE', 'CLEARANCES', 'INTERCEPTIONS', 'XG', 'TEAM_RANK', 'TEAM_WINS');

-- CreateEnum
CREATE TYPE "BonusPeriod" AS ENUM ('SEASON', 'MONTH', 'MATCH');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('PERMANENT_IN', 'PERMANENT_OUT', 'LOAN_OUT', 'LOAN_IN', 'FREE', 'RELEASE');

-- CreateEnum
CREATE TYPE "RecallStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('HEAD_FACE', 'NECK_SHOULDER', 'TORSO_BACK', 'THIGH_FRONT', 'THIGH_BACK', 'KNEE', 'SHIN_CALF', 'ANKLE', 'FOOT_TOE', 'OTHER');

-- CreateEnum
CREATE TYPE "InjuryCause" AS ENUM ('TRAINING', 'MATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('OCCURRED', 'DIAGNOSED', 'REHABILITATING', 'READY_TO_RETURN', 'RETURNED');

-- CreateEnum
CREATE TYPE "HospitalType" AS ENUM ('ACCREDITED', 'GENERAL');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('MANUFACTURER', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "PartnerContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "EquipmentLoanStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ISSUED', 'RETURNED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('INDIVIDUAL_SKILL', 'TACTICAL_DEFENSIVE', 'TACTICAL_ATTACKING', 'TACTICAL_FULL_TEAM', 'PHYSICAL', 'PSYCHOLOGICAL_SOCIAL', 'SET_PIECE', 'GOALKEEPER');

-- CreateEnum
CREATE TYPE "ContentPhase" AS ENUM ('WARMUP', 'DRILL', 'TACTICAL', 'GAME');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT_UNAUTHORIZED', 'LATE_UNAUTHORIZED', 'ABSENT_AUTHORIZED');

-- CreateEnum
CREATE TYPE "TacticalPhase" AS ENUM ('PRE_MATCH', 'POST_MATCH');

-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'DOMESTIC_CUP', 'CONTINENTAL', 'PLAYOFF', 'FRIENDLY');

-- CreateEnum
CREATE TYPE "Venue" AS ENUM ('HOME', 'AWAY', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONTRACT_EXPIRY', 'PERFORMANCE_BONUS_ACHIEVED', 'INJURY_OCCURRED', 'INJURY_READY_TO_RETURN', 'INJURY_RETURNED', 'SQUAD_DEPTH_LOW', 'TRAINING_ATTENDANCE_WARNING', 'EQUIPMENT_LOW_STOCK', 'EXTENSION_OPTION_AVAILABLE', 'EXTERNAL_REPORT_CREATED', 'EXTERNAL_REPORT_DUE_SOON', 'EXTERNAL_REPORT_OVERDUE', 'MEDICAL_EXPENSE_SUBMITTED', 'MEDICAL_EXPENSE_LEADER_APPROVED', 'MEDICAL_EXPENSE_REJECTED', 'MEDICAL_EXPENSE_APPROVED', 'REPORT_SUBMITTED', 'REPORT_REJECTED', 'COACH_AUTO_SHORTLISTED', 'COACH_MANUALLY_SHORTLISTED', 'COACH_SHORTLISTED', 'COACH_APPROVAL_REQUESTED', 'COACH_APPROVAL_PENDING', 'COACH_CONTRACTED', 'COACH_HEAD_CONTRACTED', 'COACH_ARCHIVED', 'COACH_TUTOR_SUPPORT_NEEDED', 'TRAINING_LOAD_ALERT', 'PLAYER_DEVELOPMENT_PLAN_ACTIVATED', 'PLAYER_CONTRACT_SIGNED', 'ATTENDANCE_PENALTY', 'TRAINING_SESSION_PENDING', 'VIDEO_ASSIGNED', 'VIDEO_ASSIGNMENT_OVERDUE', 'WORK_PERMIT_EXPIRY_SOON', 'CALLUP_REQUESTED', 'CALLUP_APPROVED', 'CALLUP_REJECTED', 'CALLUP_DOCS_READY', 'LOAN_OUT_EXPIRED', 'TACTICAL_ANALYSIS_CONFIRM_REQUESTED', 'JERSEY_NUMBER_CONFLICT', 'MATCH_DAY_REMINDER', 'ATTENDANCE_UNAUTHORIZED', 'ATTENDANCE_PENALTY_PLAYER', 'YOUTH_REGISTRATION_STATUS_CHANGED', 'YOUTH_WEEKLY_SCHEDULE', 'YOUTH_SESSION_CHANGED', 'GUARDIAN_CHILD_INJURY', 'GUARDIAN_CHILD_CALLUP', 'INCIDENT_REPORT_SUBMITTED', 'GROWTH_REPORT_PUBLISHED', 'SAFEGUARD_EMERGENCY', 'FEE_INVOICE_ISSUED', 'FEE_REMINDER', 'FEE_OVERDUE_WARNING', 'FEE_ACCOUNT_LOCKED', 'FACILITY_EMERGENCY', 'FACILITY_MAINTENANCE_RESOLVED', 'PAYROLL_CONFIRMED', 'JOB_POSTING_DRAFT_CREATED', 'PAYROLL_SECOND_APPROVED', 'IT_ASSET_EXPIRY_SOON', 'IT_ASSET_RETIREMENT_SYNC', 'INVENTORY_LOW_STOCK', 'FINANCE_SUBMIT_REQUIRED', 'SALES_NEGATIVE_VALUE', 'LICENSE_SEAT_EXCEEDED');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('KRW', 'USD', 'EUR', 'GBP');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerEntryCategory" AS ENUM ('SALARY', 'EQUIPMENT_PURCHASE', 'FACILITY_REPAIR', 'TRANSFER_FEE', 'TICKET_SALES', 'UNIFORM_SALES', 'SPONSORSHIP', 'ACADEMY_FEE', 'REFUND', 'OTHER');

-- CreateEnum
CREATE TYPE "SalesType" AS ENUM ('TICKET', 'UNIFORM', 'OTHER');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('PASSION_KING', 'SPACE_WIZARD', 'BEST_PASSER', 'TEAM_PLAYER', 'MOST_IMPROVED', 'DEFENSIVE_WALL', 'GOAL_MACHINE');

-- CreateEnum
CREATE TYPE "TacticalStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "WageCapType" AS ENUM ('FIXED', 'RATIO');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('CLOTHING', 'FOOTWEAR', 'BALL_AND_TOOLS', 'REHABILITATION', 'TACTICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentUnitStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('ACTIVE', 'MEDICAL_TEST', 'CONTRACT_PENDING', 'SIGNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VisaEligibility" AS ENUM ('NOT_REQUIRED', 'CONFIRMED', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "WorkPermitStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('FIRST_TEAM', 'YOUTH', 'B_TEAM');

-- CreateEnum
CREATE TYPE "CoachStatus" AS ENUM ('CANDIDATE', 'SHORTLISTED', 'APPROVAL_PENDING', 'CONTRACTED', 'RETIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShortlistSource" AS ENUM ('SYSTEM', 'MANUAL');

-- CreateEnum
CREATE TYPE "TutorType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "HiringRoundStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "BonusTeamScope" AS ENUM ('ALL', 'FIRST_TEAM_ONLY');

-- CreateEnum
CREATE TYPE "PlayerDevelopmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVIEWED');

-- CreateEnum
CREATE TYPE "JerseyNumberStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RETIRED', 'RESERVED');

-- CreateEnum
CREATE TYPE "MarketValueSource" AS ENUM ('MANUAL', 'EXTERNAL_API');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('SARAMIN', 'GLASSDOOR', 'INDEED', 'FACEBOOK', 'DIRECT');

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
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'RESOLVED', 'REJECTED');

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

-- CreateEnum
CREATE TYPE "ExternalReportTarget" AS ENUM ('EDUCATION_OFFICE', 'SCHOOL_SAFETY', 'LEAGUE', 'FEDERATION', 'INSURANCE', 'POLICE', 'CHILD_PROTECTION_AGENCY', 'FOOTBALL_ASSOCIATION');

-- CreateEnum
CREATE TYPE "SafeguardReportStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ExternalReportStatus" AS ENUM ('PENDING_SUBMISSION', 'SUBMITTED', 'SUPPLEMENT_REQUESTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ShotResult" AS ENUM ('GOAL', 'ON_TARGET', 'OFF_TARGET', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PERFORMANCE', 'MEDICAL', 'TRAINING', 'HR', 'FINANCIAL', 'ASSET');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'FIRST_APPROVED', 'SECOND_APPROVED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpenseCostCategory" AS ENUM ('OUTPATIENT', 'EXAMINATION', 'SURGERY', 'REHABILITATION', 'MEDICATION');

-- CreateEnum
CREATE TYPE "ExpensePayerType" AS ENUM ('CLUB', 'ASSOCIATION', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "MedicalExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LEADER_APPROVED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MealExpenseType" AS ENUM ('TRAINING', 'MATCH');

-- CreateEnum
CREATE TYPE "RehabStage" AS ENUM ('INITIAL_TREATMENT', 'ACUTE_TREATMENT', 'REHABILITATION', 'RETURN_TRAINING', 'CLEARED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SecurityLevel" AS ENUM ('INTERNAL', 'MEDICAL', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ReferenceSource" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "PlayerCallupStatus" AS ENUM ('REQUESTED', 'DOCS_SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CallupType" AS ENUM ('TRAINING', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PAID', 'OVERDUE', 'LOCKED');

-- CreateEnum
CREATE TYPE "DeptRole" AS ENUM ('MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "OperatingCategory" AS ENUM ('MEDICAL', 'MEAL', 'TRAVEL', 'EQUIPMENT', 'SCOUTING', 'YOUTH');

-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEW_1', 'INTERVIEW_2', 'REFERENCE_CHECK', 'OFFERED', 'ONBOARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InterviewRound" AS ENUM ('ROUND_1', 'ROUND_2');

-- CreateEnum
CREATE TYPE "InterviewResult" AS ENUM ('PENDING', 'PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "ReferenceCheckResult" AS ENUM ('PENDING', 'CLEAR', 'FLAGGED');

-- CreateTable
CREATE TABLE "Club" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLite" BOOLEAN NOT NULL DEFAULT false,
    "countryId" INTEGER,
    "ownerEmail" TEXT,
    "businessRegNumber" TEXT,
    "companyNumber" TEXT,
    "vatNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TeamType" NOT NULL,
    "ageGroup" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackStats" BOOLEAN NOT NULL DEFAULT true,
    "requiresContract" BOOLEAN NOT NULL DEFAULT true,
    "clubId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumber" (
    "id" SERIAL NOT NULL,
    "iv" TEXT NOT NULL,
    "encrypted" TEXT NOT NULL,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "coachingRole" "CoachingRole",
    "frontOfficeRole" "FrontOfficeRole",
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isOutOfOffice" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'ko',
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "phoneNumberId" INTEGER NOT NULL,
    "nationalityId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "clubId" INTEGER,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'UPCOMING',
    "wageCapType" "WageCapType",
    "wageCapValue" DOUBLE PRECISION,
    "leagueLevel" "LeagueLevel",
    "leagueId" INTEGER,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "level" "LeagueLevel" NOT NULL,
    "year" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubLeague" (
    "clubId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubLeague_pkey" PRIMARY KEY ("clubId","leagueId")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "preferredFoot" "Foot" NOT NULL,
    "height" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "position" "Position" NOT NULL,
    "level" "PlayerLevel" NOT NULL,
    "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "externalId" TEXT,
    "nationalityId" INTEGER NOT NULL,
    "userId" INTEGER,
    "agentId" INTEGER,
    "guardianId" INTEGER,
    "workPermitStatus" "WorkPermitStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "workPermitExpiry" TIMESTAMP(3),
    "teamId" INTEGER,
    "playStyle" TEXT,
    "allergies" TEXT[],
    "foodPreferences" TEXT,
    "currentMarketValue" DOUBLE PRECISION,
    "studentCode" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "salary" INTEGER NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "contractType" "ContractType" NOT NULL DEFAULT 'PROFESSIONAL',
    "playerId" TEXT NOT NULL,
    "managedById" INTEGER,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyoutClause" (
    "id" SERIAL NOT NULL,
    "amount" BIGINT NOT NULL,
    "contractId" INTEGER NOT NULL,

    CONSTRAINT "BuyoutClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtensionOption" (
    "id" SERIAL NOT NULL,
    "condition" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,

    CONSTRAINT "ExtensionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceBonus" (
    "id" SERIAL NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "contractId" INTEGER NOT NULL,

    CONSTRAINT "PerformanceBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusTrigger" (
    "id" SERIAL NOT NULL,
    "metric" "BonusMetric" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "period" "BonusPeriod" NOT NULL,
    "competitionType" "CompetitionType",
    "teamScope" "BonusTeamScope" NOT NULL DEFAULT 'ALL',
    "bonusId" INTEGER NOT NULL,

    CONSTRAINT "BonusTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" SERIAL NOT NULL,
    "type" "TransferType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "fee" INTEGER,
    "fromClub" TEXT,
    "toClub" TEXT,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recall" (
    "id" SERIAL NOT NULL,
    "status" "RecallStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "transferId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "approvedById" INTEGER,

    CONSTRAINT "Recall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "type" "PartnerType" NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "website" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerContract" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "status" "PartnerContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "sponsorshipFee" DOUBLE PRECISION,
    "discountRate" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentLoan" (
    "id" SERIAL NOT NULL,
    "status" "EquipmentLoanStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "issuedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "equipmentItemId" INTEGER NOT NULL,
    "equipmentUnitId" INTEGER,

    CONSTRAINT "EquipmentLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Injury" (
    "id" SERIAL NOT NULL,
    "bodyPart" "BodyPart" NOT NULL,
    "cause" "InjuryCause" NOT NULL,
    "expectedReturnDate" TIMESTAMP(3),
    "status" "InjuryStatus" NOT NULL DEFAULT 'OCCURRED',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" TEXT NOT NULL,
    "medicalStaffId" INTEGER NOT NULL,
    "hospitalType" "HospitalType",
    "partnerId" INTEGER,
    "customHospitalName" TEXT,

    CONSTRAINT "Injury_pkey" PRIMARY KEY ("id")
);

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
    "injuryId" INTEGER,
    "incidentReportId" INTEGER,
    "safeguardReportId" INTEGER,
    "target" "ExternalReportTarget" NOT NULL,
    "status" "ExternalReportStatus" NOT NULL DEFAULT 'PENDING_SUBMISSION',
    "reportData" JSONB NOT NULL,
    "dueDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submittedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "homeTeamName" TEXT NOT NULL,
    "awayTeamName" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "competitionType" "CompetitionType" NOT NULL,
    "venue" "Venue",
    "externalId" TEXT,
    "seasonId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "statSheetRaw" JSONB,
    "statSheetImagePath" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMatchStats" (
    "id" SERIAL NOT NULL,
    "goals" INTEGER,
    "assists" INTEGER,
    "xG" DOUBLE PRECISION,
    "xA" DOUBLE PRECISION,
    "shots" INTEGER,
    "keyPasses" INTEGER,
    "tackles" INTEGER,
    "tacklesAttempted" INTEGER,
    "tackleSuccessRate" DOUBLE PRECISION,
    "clearances" INTEGER,
    "interceptions" INTEGER,
    "saves" INTEGER,
    "cleanSheet" BOOLEAN,
    "minutesPlayed" INTEGER,
    "passesAttempted" INTEGER,
    "passesCompleted" INTEGER,
    "aerialDuels" INTEGER,
    "aerialDuelsAttempted" INTEGER,
    "aerialDuelSuccessRate" DOUBLE PRECISION,
    "groundDuels" INTEGER,
    "groundDuelsAttempted" INTEGER,
    "groundDuelSuccessRate" DOUBLE PRECISION,
    "ballRecoveries" INTEGER,
    "turnovers" INTEGER,
    "distanceCovered" DOUBLE PRECISION,
    "sprint" DOUBLE PRECISION,
    "clearCutChanceRate" DOUBLE PRECISION,
    "penaltyConversionRate" DOUBLE PRECISION,
    "freeKickConversionRate" DOUBLE PRECISION,
    "foulsCommitted" INTEGER,
    "crossesCompleted" INTEGER,
    "shotsOnTarget" INTEGER,
    "shotsAllowed" INTEGER,
    "shotBlocked" INTEGER,
    "dribblesAttempted" INTEGER,
    "dribblesCompleted" INTEGER,
    "dribblesFailed" INTEGER,
    "longPassesAttempted" INTEGER,
    "longPassesCompleted" INTEGER,
    "matchId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "PlayerMatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShotEvent" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "shooterId" TEXT NOT NULL,
    "assisterId" TEXT,
    "assisterPositionOverride" TEXT,
    "xG" DOUBLE PRECISION NOT NULL,
    "result" "ShotResult" NOT NULL,
    "minute" INTEGER,

    CONSTRAINT "ShotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMatchStats" (
    "id" SERIAL NOT NULL,
    "possession" INTEGER NOT NULL,
    "shots" INTEGER NOT NULL,
    "shotsOnTarget" INTEGER NOT NULL,
    "passes" INTEGER NOT NULL,
    "passAccuracy" DOUBLE PRECISION NOT NULL,
    "fouls" INTEGER NOT NULL,
    "yellowCards" INTEGER NOT NULL,
    "redCards" INTEGER NOT NULL,
    "xG" DOUBLE PRECISION NOT NULL,
    "corners" INTEGER NOT NULL,
    "offsides" INTEGER NOT NULL,
    "tackles" INTEGER NOT NULL,
    "interceptions" INTEGER NOT NULL,
    "clearances" INTEGER NOT NULL,
    "oppShots" INTEGER,
    "oppShotsOnTarget" INTEGER,
    "oppCorners" INTEGER,
    "oppFouls" INTEGER,
    "oppYellowCards" INTEGER,
    "oppRedCards" INTEGER,
    "oppXG" DOUBLE PRECISION,
    "oppOffsides" INTEGER,
    "matchId" INTEGER NOT NULL,

    CONSTRAINT "TeamMatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "goal" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seasonId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "teamId" INTEGER,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingContent" (
    "id" SERIAL NOT NULL,
    "phase" "ContentPhase" NOT NULL,
    "description" TEXT NOT NULL,
    "sessionId" INTEGER NOT NULL,

    CONSTRAINT "TrainingContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingParticipant" (
    "sessionId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "TrainingParticipant_pkey" PRIMARY KEY ("sessionId","playerId")
);

-- CreateTable
CREATE TABLE "TrainingResult" (
    "id" SERIAL NOT NULL,
    "attendance" "AttendanceStatus" NOT NULL,
    "feedback" TEXT,
    "performanceScore" INTEGER,
    "scoredById" INTEGER,
    "sessionId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "TrainingResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacticalAnalysis" (
    "id" SERIAL NOT NULL,
    "phase" "TacticalPhase" NOT NULL,
    "formation" TEXT,
    "opponentAnalysis" TEXT,
    "status" "TacticalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "opponentFormation" TEXT,
    "opponentKeyThreat" TEXT,
    "opponentWeakness" TEXT,
    "opponentKeyPlayer" TEXT,
    "tacticalCompliance" TEXT,
    "concededAnalysis" TEXT,
    "momPlayerId" TEXT,
    "momNote" TEXT,
    "improvementPlayerId" TEXT,
    "improvementNote" TEXT,

    CONSTRAINT "TacticalAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacticalLineup" (
    "id" SERIAL NOT NULL,
    "position" "Position" NOT NULL,
    "tacticalAnalysisId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "TacticalLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacticalMedia" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tacticalAnalysisId" INTEGER NOT NULL,

    CONSTRAINT "TacticalMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityId" INTEGER,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "trackedIndividually" BOOLEAN NOT NULL,
    "quantity" INTEGER,
    "lowStockThreshold" INTEGER,
    "partnerId" INTEGER,

    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentUnit" (
    "id" SERIAL NOT NULL,
    "status" "EquipmentUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "equipmentItemId" INTEGER NOT NULL,
    "serialNumber" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "purchaseValue" DECIMAL(12,2),
    "bookValue" DECIMAL(12,2),
    "depreciationRate" DECIMAL(5,4),
    "depreciationMethod" "DepreciationMethod",
    "isHighValue" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAssignment" (
    "id" SERIAL NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "playerId" TEXT NOT NULL,
    "equipmentItemId" INTEGER,
    "equipmentUnitId" INTEGER,

    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT,
    "position" "Position",
    "currentTeam" TEXT,
    "notes" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'ACTIVE',
    "convertedPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "visaRequired" BOOLEAN NOT NULL DEFAULT false,
    "visaEligibility" "VisaEligibility",

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "type" "ReportType" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "rejectionReason" TEXT,
    "authorId" INTEGER NOT NULL,
    "reviewerId" INTEGER,
    "firstReviewerId" INTEGER,
    "firstReviewedAt" TIMESTAMP(3),
    "secondReviewerId" INTEGER,
    "secondReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalExpense" (
    "id" SERIAL NOT NULL,
    "status" "MedicalExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "injuryId" INTEGER,
    "playerId" TEXT,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "costCategory" "ExpenseCostCategory" NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "payerType" "ExpensePayerType" NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "rejectionReason" TEXT,
    "submittedById" INTEGER NOT NULL,
    "leaderReviewerId" INTEGER,
    "adminReviewerId" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "leaderReviewedAt" TIMESTAMP(3),
    "adminReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalExpense_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "CoachHiringRound" (
    "id" SERIAL NOT NULL,
    "targetRole" "CoachingRole" NOT NULL,
    "fitScoreThreshold" INTEGER NOT NULL DEFAULT 70,
    "status" "HiringRoundStatus" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "budget" INTEGER,
    "notes" TEXT,
    "result" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachHiringRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT,
    "coachingRole" "CoachingRole" NOT NULL,
    "status" "CoachStatus" NOT NULL DEFAULT 'CANDIDATE',
    "shortlistSource" "ShortlistSource",
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "packageLeadId" INTEGER,
    "hiringRoundId" INTEGER,
    "userId" INTEGER,
    "teamId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeadCoachEvaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "possession" DOUBLE PRECISION,
    "pressingIntensity" DOUBLE PRECISION,
    "progressivePassAccuracy" DOUBLE PRECISION,
    "teamActivity" DOUBLE PRECISION,
    "philosophyFitScore" DOUBLE PRECISION,
    "dataSource" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "HeadCoachEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefensiveCoachEvaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "tackleSuccessRate" DOUBLE PRECISION,
    "clearances" DOUBLE PRECISION,
    "blocks" DOUBLE PRECISION,
    "defensiveErrors" DOUBLE PRECISION,
    "ballRecovery" DOUBLE PRECISION,
    "pressingIntensity" DOUBLE PRECISION,
    "dataSource" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "DefensiveCoachEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackingCoachEvaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "xG" DOUBLE PRECISION,
    "xA" DOUBLE PRECISION,
    "chanceCreation" DOUBLE PRECISION,
    "dribbleSuccessRate" DOUBLE PRECISION,
    "progressivePassAccuracy" DOUBLE PRECISION,
    "shotConversionRate" DOUBLE PRECISION,
    "goalInvolvement" DOUBLE PRECISION,
    "dataSource" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "AttackingCoachEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalkeeperCoachEvaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "psxG" DOUBLE PRECISION,
    "xGConcededDiff" DOUBLE PRECISION,
    "buildupPassAccuracy" DOUBLE PRECISION,
    "dataSource" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "GoalkeeperCoachEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachTier2Evaluation" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "fitScore" INTEGER,
    "notes" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "CoachTier2Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSecondaryPosition" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "fitnessTarget" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerSecondaryPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingStaffEvaluation" (
    "id" SERIAL NOT NULL,
    "staffUserId" INTEGER NOT NULL,
    "evaluatorId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachingStaffEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachTutorAssignment" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "type" "TutorType" NOT NULL,
    "internalTutorId" INTEGER,
    "externalName" TEXT,
    "externalContact" TEXT,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "languageProficiency" "LanguageProficiency",
    "tacticalImplementationRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachTutorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachAvailability" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingLoad" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "rpe" INTEGER NOT NULL,
    "load" INTEGER,

    CONSTRAINT "TrainingLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDevelopmentPlan" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "coachId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "goals" TEXT NOT NULL,
    "notes" TEXT,
    "status" "PlayerDevelopmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDevelopmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingVideo" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tags" TEXT[],
    "sessionType" "SessionType",
    "uploadedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSummary" TEXT,

    CONSTRAINT "TrainingVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAssignment" (
    "id" SERIAL NOT NULL,
    "videoId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "assignedById" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "progressRate" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingReference" (
    "id" SERIAL NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" "ReferenceSource" NOT NULL,
    "tags" TEXT[],
    "addedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingReference_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "GuardianInviteCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "issuedById" INTEGER NOT NULL,
    "usedById" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianInviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "SafeguardReport" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "contactInfo" TEXT,
    "accusedUserId" INTEGER,
    "status" "SafeguardReportStatus" NOT NULL DEFAULT 'RECEIVED',
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafeguardReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthEvaluation" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "coachId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "attitudeScore" INTEGER NOT NULL,
    "attitudeComment" TEXT NOT NULL,
    "fundamentalsScore" INTEGER NOT NULL,
    "fundamentalsComment" TEXT NOT NULL,
    "spatialScore" INTEGER NOT NULL,
    "spatialComment" TEXT NOT NULL,
    "physicalScore" INTEGER NOT NULL,
    "physicalComment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerBadge" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "coachId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "badgeType" "BadgeType" NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "PlayerBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerCallup" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" INTEGER NOT NULL,
    "toTeamId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "reason" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "status" "PlayerCallupStatus" NOT NULL DEFAULT 'REQUESTED',
    "callupType" "CallupType" NOT NULL DEFAULT 'OFFICIAL',
    "youthCoachConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "medicalConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerCallup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JerseyNumber" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "JerseyNumberStatus" NOT NULL DEFAULT 'AVAILABLE',
    "teamId" INTEGER NOT NULL,
    "playerId" TEXT,

    CONSTRAINT "JerseyNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketValueHistory" (
    "id" SERIAL NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" "MarketValueSource" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" INTEGER,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "MarketValueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSquad" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "MatchSquad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineup" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "formation" TEXT NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,

    CONSTRAINT "MatchLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupSlot" (
    "id" SERIAL NOT NULL,
    "lineupId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "isStarter" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyFee" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "guardianId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentProofUrl" TEXT,
    "paymentSubmittedAt" TIMESTAMP(3),
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "ibiBeta" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "ClubSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRecord" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "departmentId" INTEGER,
    "phone" TEXT,
    "email" TEXT,
    "employeeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "terminatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealExpense" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialReport" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "totalRevenue" INTEGER NOT NULL,
    "totalOperatingBudget" INTEGER,
    "contingencyReserve" INTEGER DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "DepartmentCategory",
    "parentId" INTEGER,
    "headId" INTEGER,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDepartment" (
    "userId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "role" "DeptRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("userId","departmentId")
);

-- CreateTable
CREATE TABLE "BudgetCategoryPlan" (
    "id" SERIAL NOT NULL,
    "financialReportId" INTEGER NOT NULL,
    "category" "OperatingCategory" NOT NULL,
    "mandatoryMinimum" INTEGER NOT NULL DEFAULT 0,
    "knapsackAllocated" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCategoryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetTier" (
    "id" SERIAL NOT NULL,
    "categoryPlanId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetOverrideLog" (
    "id" SERIAL NOT NULL,
    "financialReportId" INTEGER NOT NULL,
    "category" "OperatingCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetOverrideLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingExpense" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "category" "OperatingCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" INTEGER,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'DRAFT',
    "externalJobId" TEXT,
    "createdById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" SERIAL NOT NULL,
    "postingId" INTEGER NOT NULL,
    "applicantName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "resumeUrl" TEXT,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "rejectedAt" TIMESTAMP(3),
    "offeredAt" TIMESTAMP(3),
    "offeredById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "source" "ApplicationSource",
    "externalApplicantId" TEXT,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "round" "InterviewRound" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "interviewerIds" INTEGER[],
    "scoreSkill" INTEGER,
    "scoreComm" INTEGER,
    "scoreCulture" INTEGER,
    "comment" TEXT,
    "result" "InterviewResult" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceCheck" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "contactName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "result" "ReferenceCheckResult" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Onboarding" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "userId" INTEGER,
    "otpCode" TEXT NOT NULL,
    "otpExpiresAt" TIMESTAMP(3) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "mfaRegisteredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Onboarding_pkey" PRIMARY KEY ("id")
);

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
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "gmApprovedById" INTEGER,
    "gmApprovedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "financeSubmittedAt" TIMESTAMP(3),
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
    "secondApprovedById" INTEGER,
    "secondApprovedAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvite" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "coachingRole" "CoachingRole",
    "frontOfficeRole" "FrontOfficeRole",
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareLicense" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "usedSeats" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "renewalCost" DECIMAL(12,2),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" SERIAL NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "category" "LedgerEntryCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'KRW',
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "amountKrw" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "relatedModule" TEXT,
    "relatedId" INTEGER,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRecord" (
    "id" SERIAL NOT NULL,
    "type" "SalesType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'KRW',
    "saleDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityInventoryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_ownerEmail_key" ON "Club"("ownerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumberId_key" ON "User"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "League_level_year_key" ON "League"("level", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalId_key" ON "Player"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_studentCode_key" ON "Player"("studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "BuyoutClause_contractId_key" ON "BuyoutClause"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Recall_transferId_key" ON "Recall"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "InjuryAssessment_injuryId_key" ON "InjuryAssessment"("injuryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReport_injuryId_target_key" ON "ExternalReport"("injuryId", "target");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReport_incidentReportId_target_key" ON "ExternalReport"("incidentReportId", "target");

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchStats_matchId_playerId_key" ON "PlayerMatchStats"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "ShotEvent_matchId_idx" ON "ShotEvent"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchStats_matchId_key" ON "TeamMatchStats"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingResult_sessionId_playerId_key" ON "TrainingResult"("sessionId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "InjuryReport_injuryId_key" ON "InjuryReport"("injuryId");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_userId_key" ON "Coach"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HeadCoachEvaluation_coachId_key" ON "HeadCoachEvaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "DefensiveCoachEvaluation_coachId_key" ON "DefensiveCoachEvaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "AttackingCoachEvaluation_coachId_key" ON "AttackingCoachEvaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalkeeperCoachEvaluation_coachId_key" ON "GoalkeeperCoachEvaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachTier2Evaluation_coachId_key" ON "CoachTier2Evaluation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSecondaryPosition_playerId_position_key" ON "PlayerSecondaryPosition"("playerId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingLoad_playerId_sessionId_key" ON "TrainingLoad"("playerId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDevelopmentPlan_playerId_seasonId_key" ON "PlayerDevelopmentPlan"("playerId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoAssignment_videoId_playerId_key" ON "VideoAssignment"("videoId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianInviteCode_code_key" ON "GuardianInviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthEvaluation_playerId_year_month_key" ON "GrowthEvaluation"("playerId", "year", "month");

-- CreateIndex
CREATE INDEX "JerseyNumber_playerId_idx" ON "JerseyNumber"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "JerseyNumber_number_teamId_key" ON "JerseyNumber"("number", "teamId");

-- CreateIndex
CREATE INDEX "MarketValueHistory_playerId_recordedAt_idx" ON "MarketValueHistory"("playerId", "recordedAt");

-- CreateIndex
CREATE INDEX "MatchSquad_matchId_idx" ON "MatchSquad"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSquad_matchId_playerId_key" ON "MatchSquad"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineup_matchId_key" ON "MatchLineup"("matchId");

-- CreateIndex
CREATE INDEX "MatchLineup_matchId_idx" ON "MatchLineup"("matchId");

-- CreateIndex
CREATE INDEX "LineupSlot_lineupId_idx" ON "LineupSlot"("lineupId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupSlot_lineupId_slotKey_key" ON "LineupSlot"("lineupId", "slotKey");

-- CreateIndex
CREATE UNIQUE INDEX "LineupSlot_lineupId_playerId_key" ON "LineupSlot"("lineupId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyFee_playerId_year_month_key" ON "AcademyFee"("playerId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRecord_email_key" ON "StaffRecord"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRecord_employeeId_key" ON "StaffRecord"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialReport_seasonId_key" ON "FinancialReport"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCategoryPlan_financialReportId_category_key" ON "BudgetCategoryPlan"("financialReportId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_postingId_externalApplicantId_key" ON "JobApplication"("postingId", "externalApplicantId");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_applicationId_round_key" ON "Interview"("applicationId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceCheck_applicationId_key" ON "ReferenceCheck"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Onboarding_applicationId_key" ON "Onboarding"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Onboarding_userId_key" ON "Onboarding"("userId");

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
CREATE UNIQUE INDEX "UserInvite_token_key" ON "UserInvite"("token");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_nationalityId_fkey" FOREIGN KEY ("nationalityId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubLeague" ADD CONSTRAINT "ClubLeague_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubLeague" ADD CONSTRAINT "ClubLeague_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_nationalityId_fkey" FOREIGN KEY ("nationalityId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyoutClause" ADD CONSTRAINT "BuyoutClause_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionOption" ADD CONSTRAINT "ExtensionOption_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceBonus" ADD CONSTRAINT "PerformanceBonus_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusTrigger" ADD CONSTRAINT "BonusTrigger_bonusId_fkey" FOREIGN KEY ("bonusId") REFERENCES "PerformanceBonus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerContract" ADD CONSTRAINT "PartnerContract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentLoan" ADD CONSTRAINT "EquipmentLoan_equipmentUnitId_fkey" FOREIGN KEY ("equipmentUnitId") REFERENCES "EquipmentUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_medicalStaffId_fkey" FOREIGN KEY ("medicalStaffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryAssessment" ADD CONSTRAINT "InjuryAssessment_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryAssessment" ADD CONSTRAINT "InjuryAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReport" ADD CONSTRAINT "ExternalReport_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReport" ADD CONSTRAINT "ExternalReport_incidentReportId_fkey" FOREIGN KEY ("incidentReportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotEvent" ADD CONSTRAINT "ShotEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotEvent" ADD CONSTRAINT "ShotEvent_shooterId_fkey" FOREIGN KEY ("shooterId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotEvent" ADD CONSTRAINT "ShotEvent_assisterId_fkey" FOREIGN KEY ("assisterId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchStats" ADD CONSTRAINT "TeamMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingContent" ADD CONSTRAINT "TrainingContent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingResult" ADD CONSTRAINT "TrainingResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingResult" ADD CONSTRAINT "TrainingResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingResult" ADD CONSTRAINT "TrainingResult_scoredById_fkey" FOREIGN KEY ("scoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_momPlayerId_fkey" FOREIGN KEY ("momPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_improvementPlayerId_fkey" FOREIGN KEY ("improvementPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalLineup" ADD CONSTRAINT "TacticalLineup_tacticalAnalysisId_fkey" FOREIGN KEY ("tacticalAnalysisId") REFERENCES "TacticalAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalLineup" ADD CONSTRAINT "TacticalLineup_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalMedia" ADD CONSTRAINT "TacticalMedia_tacticalAnalysisId_fkey" FOREIGN KEY ("tacticalAnalysisId") REFERENCES "TacticalAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentItem" ADD CONSTRAINT "EquipmentItem_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentUnit" ADD CONSTRAINT "EquipmentUnit_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentUnitId_fkey" FOREIGN KEY ("equipmentUnitId") REFERENCES "EquipmentUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_convertedPlayerId_fkey" FOREIGN KEY ("convertedPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_firstReviewerId_fkey" FOREIGN KEY ("firstReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_secondReviewerId_fkey" FOREIGN KEY ("secondReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_leaderReviewerId_fkey" FOREIGN KEY ("leaderReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_adminReviewerId_fkey" FOREIGN KEY ("adminReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "CoachHiringRound" ADD CONSTRAINT "CoachHiringRound_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_packageLeadId_fkey" FOREIGN KEY ("packageLeadId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_hiringRoundId_fkey" FOREIGN KEY ("hiringRoundId") REFERENCES "CoachHiringRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeadCoachEvaluation" ADD CONSTRAINT "HeadCoachEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefensiveCoachEvaluation" ADD CONSTRAINT "DefensiveCoachEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackingCoachEvaluation" ADD CONSTRAINT "AttackingCoachEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalkeeperCoachEvaluation" ADD CONSTRAINT "GoalkeeperCoachEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTier2Evaluation" ADD CONSTRAINT "CoachTier2Evaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSecondaryPosition" ADD CONSTRAINT "PlayerSecondaryPosition_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingStaffEvaluation" ADD CONSTRAINT "CoachingStaffEvaluation_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingStaffEvaluation" ADD CONSTRAINT "CoachingStaffEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTutorAssignment" ADD CONSTRAINT "CoachTutorAssignment_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTutorAssignment" ADD CONSTRAINT "CoachTutorAssignment_internalTutorId_fkey" FOREIGN KEY ("internalTutorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAvailability" ADD CONSTRAINT "CoachAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAvailability" ADD CONSTRAINT "CoachAvailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLoad" ADD CONSTRAINT "TrainingLoad_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLoad" ADD CONSTRAINT "TrainingLoad_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDevelopmentPlan" ADD CONSTRAINT "PlayerDevelopmentPlan_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDevelopmentPlan" ADD CONSTRAINT "PlayerDevelopmentPlan_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDevelopmentPlan" ADD CONSTRAINT "PlayerDevelopmentPlan_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingVideo" ADD CONSTRAINT "TrainingVideo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAssignment" ADD CONSTRAINT "VideoAssignment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "TrainingVideo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAssignment" ADD CONSTRAINT "VideoAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAssignment" ADD CONSTRAINT "VideoAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingReference" ADD CONSTRAINT "TrainingReference_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouthRegistration" ADD CONSTRAINT "YouthRegistration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouthRegistration" ADD CONSTRAINT "YouthRegistration_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouthRegistration" ADD CONSTRAINT "YouthRegistration_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInviteCode" ADD CONSTRAINT "GuardianInviteCode_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInviteCode" ADD CONSTRAINT "GuardianInviteCode_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInviteCode" ADD CONSTRAINT "GuardianInviteCode_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafeguardReport" ADD CONSTRAINT "SafeguardReport_accusedUserId_fkey" FOREIGN KEY ("accusedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthEvaluation" ADD CONSTRAINT "GrowthEvaluation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthEvaluation" ADD CONSTRAINT "GrowthEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBadge" ADD CONSTRAINT "PlayerBadge_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBadge" ADD CONSTRAINT "PlayerBadge_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBadge" ADD CONSTRAINT "PlayerBadge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCallup" ADD CONSTRAINT "PlayerCallup_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCallup" ADD CONSTRAINT "PlayerCallup_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCallup" ADD CONSTRAINT "PlayerCallup_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCallup" ADD CONSTRAINT "PlayerCallup_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCallup" ADD CONSTRAINT "PlayerCallup_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JerseyNumber" ADD CONSTRAINT "JerseyNumber_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JerseyNumber" ADD CONSTRAINT "JerseyNumber_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketValueHistory" ADD CONSTRAINT "MarketValueHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketValueHistory" ADD CONSTRAINT "MarketValueHistory_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquad" ADD CONSTRAINT "MatchSquad_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquad" ADD CONSTRAINT "MatchSquad_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquad" ADD CONSTRAINT "MatchSquad_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "MatchLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyFee" ADD CONSTRAINT "AcademyFee_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyFee" ADD CONSTRAINT "AcademyFee_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReport" ADD CONSTRAINT "FinancialReport_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCategoryPlan" ADD CONSTRAINT "BudgetCategoryPlan_financialReportId_fkey" FOREIGN KEY ("financialReportId") REFERENCES "FinancialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetTier" ADD CONSTRAINT "BudgetTier_categoryPlanId_fkey" FOREIGN KEY ("categoryPlanId") REFERENCES "BudgetCategoryPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetOverrideLog" ADD CONSTRAINT "BudgetOverrideLog_financialReportId_fkey" FOREIGN KEY ("financialReportId") REFERENCES "FinancialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetOverrideLog" ADD CONSTRAINT "BudgetOverrideLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_offeredById_fkey" FOREIGN KEY ("offeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceCheck" ADD CONSTRAINT "ReferenceCheck_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_gmApprovedById_fkey" FOREIGN KEY ("gmApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_secondApprovedById_fkey" FOREIGN KEY ("secondApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareLicense" ADD CONSTRAINT "SoftwareLicense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
