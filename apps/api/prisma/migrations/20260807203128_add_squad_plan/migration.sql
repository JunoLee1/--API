-- CreateTable
CREATE TABLE "SquadPlan" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "formation" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER NOT NULL,

    CONSTRAINT "SquadPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SquadPlan_seasonId_key" ON "SquadPlan"("seasonId");

-- AddForeignKey
ALTER TABLE "SquadPlan" ADD CONSTRAINT "SquadPlan_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPlan" ADD CONSTRAINT "SquadPlan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
