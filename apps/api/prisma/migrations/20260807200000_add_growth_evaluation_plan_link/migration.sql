ALTER TABLE "GrowthEvaluation" ADD COLUMN "planId" INTEGER;
ALTER TABLE "GrowthEvaluation" ADD CONSTRAINT "GrowthEvaluation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlayerDevelopmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
