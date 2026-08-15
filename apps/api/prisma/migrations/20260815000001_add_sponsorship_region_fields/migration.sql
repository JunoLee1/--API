-- AlterTable
ALTER TABLE "Sponsorship" ADD COLUMN     "isOverseas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "businessRegNumber" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "addressDetail" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "overseasAddress" TEXT;
