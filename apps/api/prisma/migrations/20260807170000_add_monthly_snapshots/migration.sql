-- CreateTable
CREATE TABLE IF NOT EXISTS "MonthlyBudgetSnapshot" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "totalBudget" INTEGER NOT NULL,
    "totalActual" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyBudgetSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MonthlyOperationsSnapshot" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyOperationsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBudgetSnapshot_seasonId_year_month_key" ON "MonthlyBudgetSnapshot"("seasonId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyOperationsSnapshot_seasonId_year_month_key" ON "MonthlyOperationsSnapshot"("seasonId", "year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyBudgetSnapshot" ADD CONSTRAINT "MonthlyBudgetSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyOperationsSnapshot" ADD CONSTRAINT "MonthlyOperationsSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
