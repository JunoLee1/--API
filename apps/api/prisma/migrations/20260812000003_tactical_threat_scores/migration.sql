ALTER TABLE "TacticalAnalysis"
  ADD COLUMN IF NOT EXISTS "opponentPressureScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "opponentSetPieceScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "opponentCounterScore" INTEGER;

ALTER TABLE "TacticalAnalysis"
  ADD CONSTRAINT "TacticalAnalysis_opponentPressureScore_range" CHECK ("opponentPressureScore" BETWEEN 1 AND 10),
  ADD CONSTRAINT "TacticalAnalysis_opponentSetPieceScore_range" CHECK ("opponentSetPieceScore" BETWEEN 1 AND 10),
  ADD CONSTRAINT "TacticalAnalysis_opponentCounterScore_range" CHECK ("opponentCounterScore" BETWEEN 1 AND 10);
