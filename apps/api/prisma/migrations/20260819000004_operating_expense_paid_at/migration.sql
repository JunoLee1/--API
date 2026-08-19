ALTER TABLE "OperatingExpense"
  ADD COLUMN "paidAt"   TIMESTAMP(3),
  ADD COLUMN "paidById" INTEGER REFERENCES "User"("id");
