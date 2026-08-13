ALTER TABLE "TacticalAnalysis"
  ADD COLUMN IF NOT EXISTS "opponentPressureScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "opponentSetPieceScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "opponentCounterScore" INTEGER;
