-- Pedro persona: FacilityZone 세분화 (라커룸·샤워실·의무실)
ALTER TYPE "FacilityZone" ADD VALUE IF NOT EXISTS 'LOCKER_ROOM';
ALTER TYPE "FacilityZone" ADD VALUE IF NOT EXISTS 'MEDICAL_ROOM';
ALTER TYPE "FacilityZone" ADD VALUE IF NOT EXISTS 'SHOWER_ROOM';

-- Pedro persona: EquipmentUnit 위생 기록 필드
ALTER TABLE "EquipmentUnit" ADD COLUMN IF NOT EXISTS "lastSanitizedAt" TIMESTAMP(3);
ALTER TABLE "EquipmentUnit" ADD COLUMN IF NOT EXISTS "sanitationStatus" TEXT;

-- Pedro persona: FacilityInspection 위생 등급 (1-5)
ALTER TABLE "FacilityInspection" ADD COLUMN IF NOT EXISTS "sanitationScore" INTEGER;
