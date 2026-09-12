-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN "phoneHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumber_phoneHash_key" ON "PhoneNumber"("phoneHash");
