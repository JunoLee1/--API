-- AlterEnum: add new values to DepartmentCategory
ALTER TYPE "DepartmentCategory" ADD VALUE IF NOT EXISTS 'HR';
ALTER TYPE "DepartmentCategory" ADD VALUE IF NOT EXISTS 'MARKETING';
ALTER TYPE "DepartmentCategory" ADD VALUE IF NOT EXISTS 'LEGAL';
ALTER TYPE "DepartmentCategory" ADD VALUE IF NOT EXISTS 'MEDIA';

-- AlterTable: add departmentId to Report
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "departmentId" INTEGER;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
