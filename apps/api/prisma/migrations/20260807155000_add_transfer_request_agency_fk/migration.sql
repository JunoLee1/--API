-- AddForeignKey (deferred: Agency table created in 20260807150000_add_agency)
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
