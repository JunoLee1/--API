-- CreateTable
CREATE TABLE "FinancialReport" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "totalRevenue" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialReport_seasonId_key" ON "FinancialReport"("seasonId");

-- AddForeignKey
ALTER TABLE "FinancialReport" ADD CONSTRAINT "FinancialReport_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
