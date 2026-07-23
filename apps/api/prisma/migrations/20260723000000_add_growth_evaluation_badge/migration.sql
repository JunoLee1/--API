-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('PASSION_KING', 'SPACE_WIZARD', 'BEST_PASSER', 'TEAM_PLAYER', 'MOST_IMPROVED', 'DEFENSIVE_WALL', 'GOAL_MACHINE');

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

-- CreateIndex
CREATE UNIQUE INDEX "GrowthEvaluation_playerId_year_month_key" ON "GrowthEvaluation"("playerId", "year", "month");

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
