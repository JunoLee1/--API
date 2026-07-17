-- AddUniqueConstraint
CREATE UNIQUE INDEX "ExternalReport_injuryId_target_key" ON "ExternalReport"("injuryId", "target");
