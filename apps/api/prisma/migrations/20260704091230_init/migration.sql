-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF', 'PLAYER', 'AGENT');

-- CreateEnum
CREATE TYPE "CoachingRole" AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH', 'ATTACKING_COACH', 'PHYSICAL_COACH', 'SET_PIECE_COACH', 'GOALKEEPER_COACH', 'MEDICAL');

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
CREATE TYPE "TransferType" AS ENUM ('PERMANENT', 'LOAN_OUT', 'LOAN_IN', 'FREE', 'RELEASE');

-- CreateEnum
CREATE TYPE "RecallStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InjuryCause" AS ENUM ('TRAINING', 'MATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('OCCURRED', 'DIAGNOSED', 'REHABILITATING', 'READY_TO_RETURN', 'RETURNED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('INDIVIDUAL_SKILL', 'TACTICAL_DEFENSIVE', 'TACTICAL_ATTACKING', 'TACTICAL_FULL_TEAM', 'PHYSICAL', 'PSYCHOLOGICAL_SOCIAL', 'SET_PIECE');

-- CreateEnum
CREATE TYPE "ContentPhase" AS ENUM ('WARMUP', 'DRILL', 'TACTICAL', 'GAME');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT_UNAUTHORIZED', 'LATE_UNAUTHORIZED', 'ABSENT_AUTHORIZED');

-- CreateEnum
CREATE TYPE "TacticalPhase" AS ENUM ('PRE_MATCH', 'POST_MATCH');

-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'CUP', 'FRIENDLY', 'CHAMPIONS_LEAGUE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONTRACT_EXPIRY', 'PERFORMANCE_BONUS_ACHIEVED', 'INJURY_READY_TO_RETURN', 'TRAINING_ATTENDANCE_WARNING');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');

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
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isOutOfOffice" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "phoneNumberId" INTEGER NOT NULL,
    "nationalityId" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'UPCOMING',

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "salary" INTEGER NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "playerId" TEXT NOT NULL,
    "managedById" INTEGER,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyoutClause" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
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
    "amount" INTEGER NOT NULL,
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
CREATE TABLE "Injury" (
    "id" SERIAL NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "cause" "InjuryCause" NOT NULL,
    "expectedReturnDate" TIMESTAMP(3),
    "status" "InjuryStatus" NOT NULL DEFAULT 'OCCURRED',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" TEXT NOT NULL,
    "medicalStaffId" INTEGER NOT NULL,

    CONSTRAINT "Injury_pkey" PRIMARY KEY ("id")
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
    "externalId" TEXT,
    "seasonId" INTEGER NOT NULL,

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
    "passAccuracy" DOUBLE PRECISION,
    "keyPasses" INTEGER,
    "tackles" INTEGER,
    "tackleSuccessRate" DOUBLE PRECISION,
    "clearances" INTEGER,
    "interceptions" INTEGER,
    "saves" INTEGER,
    "cleanSheet" BOOLEAN,
    "minutesPlayed" INTEGER,
    "matchId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "PlayerMatchStats_pkey" PRIMARY KEY ("id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seasonId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "approvedById" INTEGER,

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
    "sessionId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "TrainingResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacticalAnalysis" (
    "id" SERIAL NOT NULL,
    "phase" "TacticalPhase" NOT NULL,
    "formation" TEXT NOT NULL,
    "opponentAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,

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
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumberId_key" ON "User"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalId_key" ON "Player"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyoutClause_contractId_key" ON "BuyoutClause"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Recall_transferId_key" ON "Recall"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchStats_matchId_key" ON "TeamMatchStats"("matchId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_nationalityId_fkey" FOREIGN KEY ("nationalityId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_nationalityId_fkey" FOREIGN KEY ("nationalityId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_medicalStaffId_fkey" FOREIGN KEY ("medicalStaffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchStats" ADD CONSTRAINT "TeamMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalLineup" ADD CONSTRAINT "TacticalLineup_tacticalAnalysisId_fkey" FOREIGN KEY ("tacticalAnalysisId") REFERENCES "TacticalAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalLineup" ADD CONSTRAINT "TacticalLineup_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalMedia" ADD CONSTRAINT "TacticalMedia_tacticalAnalysisId_fkey" FOREIGN KEY ("tacticalAnalysisId") REFERENCES "TacticalAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
