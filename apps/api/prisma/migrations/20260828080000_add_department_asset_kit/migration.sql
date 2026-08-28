-- CreateTable
CREATE TABLE "DepartmentDefaultAssetKit" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "assetItems" JSONB NOT NULL,
    "defaultExpenseCategoryId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentDefaultAssetKit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentDefaultAssetKit_departmentId_key"
  ON "DepartmentDefaultAssetKit"("departmentId");

-- AlterTable — AssetRequest 자동 프로비저닝 추적 컬럼
ALTER TABLE "AssetRequest"
  ADD COLUMN "isAutoProvisioned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "provisionedFromDispatchId" INTEGER;

-- CreateIndex — provisionedFromDispatchId 역방향 조회용
CREATE INDEX "AssetRequest_provisionedFromDispatchId_idx"
  ON "AssetRequest"("provisionedFromDispatchId");

-- AddForeignKey — DepartmentDefaultAssetKit → Department
ALTER TABLE "DepartmentDefaultAssetKit"
  ADD CONSTRAINT "DepartmentDefaultAssetKit_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — DepartmentDefaultAssetKit → ExpenseCategory
ALTER TABLE "DepartmentDefaultAssetKit"
  ADD CONSTRAINT "DepartmentDefaultAssetKit_defaultExpenseCategoryId_fkey"
  FOREIGN KEY ("defaultExpenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — DepartmentDefaultAssetKit → User (createdBy)
ALTER TABLE "DepartmentDefaultAssetKit"
  ADD CONSTRAINT "DepartmentDefaultAssetKit_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — DepartmentDefaultAssetKit → User (updatedBy, nullable)
ALTER TABLE "DepartmentDefaultAssetKit"
  ADD CONSTRAINT "DepartmentDefaultAssetKit_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey — AssetRequest.provisionedFromDispatchId → HiringDispatch
ALTER TABLE "AssetRequest"
  ADD CONSTRAINT "AssetRequest_provisionedFromDispatchId_fkey"
  FOREIGN KEY ("provisionedFromDispatchId") REFERENCES "HiringDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
