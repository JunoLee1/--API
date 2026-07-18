-- AlterTable
ALTER TABLE "TacticalAnalysis" ADD COLUMN     "concededAnalysis" TEXT,
ADD COLUMN     "improvementNote" TEXT,
ADD COLUMN     "improvementPlayerId" TEXT,
ADD COLUMN     "momNote" TEXT,
ADD COLUMN     "momPlayerId" TEXT,
ADD COLUMN     "opponentFormation" TEXT,
ADD COLUMN     "opponentKeyPlayer" TEXT,
ADD COLUMN     "opponentKeyThreat" TEXT,
ADD COLUMN     "opponentWeakness" TEXT,
ADD COLUMN     "tacticalCompliance" TEXT;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_momPlayerId_fkey" FOREIGN KEY ("momPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalAnalysis" ADD CONSTRAINT "TacticalAnalysis_improvementPlayerId_fkey" FOREIGN KEY ("improvementPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
