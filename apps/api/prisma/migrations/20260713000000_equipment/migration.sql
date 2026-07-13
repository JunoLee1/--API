-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('CLOTHING', 'FOOTWEAR', 'BALL_AND_TOOLS', 'REHABILITATION', 'TACTICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentUnitStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED');

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "trackedIndividually" BOOLEAN NOT NULL,
    "quantity" INTEGER,
    "lowStockThreshold" INTEGER,
    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentUnit" (
    "id" SERIAL NOT NULL,
    "status" "EquipmentUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "equipmentItemId" INTEGER NOT NULL,
    CONSTRAINT "EquipmentUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAssignment" (
    "id" SERIAL NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "playerId" TEXT NOT NULL,
    "equipmentItemId" INTEGER,
    "equipmentUnitId" INTEGER,
    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EquipmentUnit" ADD CONSTRAINT "EquipmentUnit_equipmentItemId_fkey"
    FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentItemId_fkey"
    FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentUnitId_fkey"
    FOREIGN KEY ("equipmentUnitId") REFERENCES "EquipmentUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
