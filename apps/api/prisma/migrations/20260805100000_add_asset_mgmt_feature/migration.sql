-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('KRW', 'USD', 'EUR', 'GBP');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerEntryCategory" AS ENUM ('SALARY', 'EQUIPMENT_PURCHASE', 'FACILITY_REPAIR', 'TRANSFER_FEE', 'TICKET_SALES', 'UNIFORM_SALES', 'SPONSORSHIP', 'ACADEMY_FEE', 'REFUND', 'OTHER');

-- CreateEnum
CREATE TYPE "SalesType" AS ENUM ('TICKET', 'UNIFORM', 'OTHER');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYROLL_SECOND_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'IT_ASSET_EXPIRY_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'IT_ASSET_RETIREMENT_SYNC';
ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_LOW_STOCK';
ALTER TYPE "NotificationType" ADD VALUE 'FINANCE_SUBMIT_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE 'SALES_NEGATIVE_VALUE';
ALTER TYPE "NotificationType" ADD VALUE 'LICENSE_SEAT_EXCEEDED';

-- AlterTable
ALTER TABLE "EquipmentUnit" ADD COLUMN     "bookValue" DECIMAL(12,2),
ADD COLUMN     "depreciationMethod" "DepreciationMethod",
ADD COLUMN     "depreciationRate" DECIMAL(5,4),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isHighValue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchaseValue" DECIMAL(12,2),
ADD COLUMN     "purchasedAt" TIMESTAMP(3),
ADD COLUMN     "serialNumber" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "financeSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "secondApprovedAt" TIMESTAMP(3),
ADD COLUMN     "secondApprovedById" INTEGER;

-- AlterTable
ALTER TABLE "StaffRecord" ADD COLUMN     "email" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "terminatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SoftwareLicense" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "usedSeats" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "renewalCost" DECIMAL(12,2),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" SERIAL NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "category" "LedgerEntryCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'KRW',
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "amountKrw" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "relatedModule" TEXT,
    "relatedId" INTEGER,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRecord" (
    "id" SERIAL NOT NULL,
    "type" "SalesType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'KRW',
    "saleDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityInventoryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffRecord_email_key" ON "StaffRecord"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRecord_employeeId_key" ON "StaffRecord"("employeeId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_secondApprovedById_fkey" FOREIGN KEY ("secondApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareLicense" ADD CONSTRAINT "SoftwareLicense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
