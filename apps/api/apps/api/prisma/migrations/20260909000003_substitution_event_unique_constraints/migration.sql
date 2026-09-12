-- CreateIndex
CREATE UNIQUE INDEX "SubstitutionEvent_matchId_fromPlayerId_key" ON "SubstitutionEvent"("matchId", "fromPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubstitutionEvent_matchId_toPlayerId_key" ON "SubstitutionEvent"("matchId", "toPlayerId");
