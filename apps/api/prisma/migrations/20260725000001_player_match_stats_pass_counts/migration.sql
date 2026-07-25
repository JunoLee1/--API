ALTER TABLE "PlayerMatchStats" DROP COLUMN "passAccuracy";
ALTER TABLE "PlayerMatchStats" ADD COLUMN "passesAttempted" INTEGER;
ALTER TABLE "PlayerMatchStats" ADD COLUMN "passesCompleted" INTEGER;
