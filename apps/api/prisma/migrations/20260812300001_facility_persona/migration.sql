ALTER TABLE "ClubSettings" ADD COLUMN "maintenanceCostLimit" INTEGER NOT NULL DEFAULT 1000000;

ALTER TABLE "MaintenanceRequest" ADD COLUMN "partnerId" INTEGER;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EquipmentUnit" ADD COLUMN "disposedById" INTEGER;
ALTER TABLE "EquipmentUnit" ADD COLUMN "disposedAt" TIMESTAMP(3);
ALTER TABLE "EquipmentUnit" ADD COLUMN "disposalNote" TEXT;
ALTER TABLE "EquipmentUnit" ADD CONSTRAINT "EquipmentUnit_disposedById_fkey"
  FOREIGN KEY ("disposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
