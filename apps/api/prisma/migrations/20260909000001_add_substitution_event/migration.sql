-- AlterTable
ALTER TABLE "Match" ADD COLUMN "extraTime" BOOLEAN;

-- CreateTable
CREATE TABLE "SubstitutionEvent" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "fromPlayerId" TEXT NOT NULL,
    "toPlayerId" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubstitutionEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SubstitutionEvent" ADD CONSTRAINT "SubstitutionEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionEvent" ADD CONSTRAINT "SubstitutionEvent_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionEvent" ADD CONSTRAINT "SubstitutionEvent_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
