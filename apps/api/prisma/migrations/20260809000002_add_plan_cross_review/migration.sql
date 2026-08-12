-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateTable
CREATE TABLE "DepartmentReviewerConfig" (
    "id" SERIAL NOT NULL,
    "subjectDepartmentId" INTEGER NOT NULL,
    "reviewerDepartmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentReviewerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanReview" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "reviewerDeptId" INTEGER NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "confirmedById" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentReviewerConfig_subjectDepartmentId_reviewerDepartmentId_key" ON "DepartmentReviewerConfig"("subjectDepartmentId", "reviewerDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanReview_planId_reviewerDeptId_key" ON "PlanReview"("planId", "reviewerDeptId");

-- AddForeignKey
ALTER TABLE "DepartmentReviewerConfig" ADD CONSTRAINT "DepartmentReviewerConfig_subjectDepartmentId_fkey" FOREIGN KEY ("subjectDepartmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentReviewerConfig" ADD CONSTRAINT "DepartmentReviewerConfig_reviewerDepartmentId_fkey" FOREIGN KEY ("reviewerDepartmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReview" ADD CONSTRAINT "PlanReview_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReview" ADD CONSTRAINT "PlanReview_reviewerDeptId_fkey" FOREIGN KEY ("reviewerDeptId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReview" ADD CONSTRAINT "PlanReview_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
