-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'REVIEWING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "DepartmentAnnualPlan" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "objectives" TEXT[],
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentAnnualPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentBudgetItem" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "category" "OperatingCategory" NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "DepartmentBudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentKpiItem" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "quarter" INTEGER,

    CONSTRAINT "DepartmentKpiItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentAnnualPlan_seasonId_departmentId_key" ON "DepartmentAnnualPlan"("seasonId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentBudgetItem_planId_category_key" ON "DepartmentBudgetItem"("planId", "category");

-- AddForeignKey
ALTER TABLE "DepartmentAnnualPlan" ADD CONSTRAINT "DepartmentAnnualPlan_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAnnualPlan" ADD CONSTRAINT "DepartmentAnnualPlan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAnnualPlan" ADD CONSTRAINT "DepartmentAnnualPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAnnualPlan" ADD CONSTRAINT "DepartmentAnnualPlan_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentBudgetItem" ADD CONSTRAINT "DepartmentBudgetItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DepartmentAnnualPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentKpiItem" ADD CONSTRAINT "DepartmentKpiItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DepartmentAnnualPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
