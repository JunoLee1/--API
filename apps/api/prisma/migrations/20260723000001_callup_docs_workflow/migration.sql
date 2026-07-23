-- AlterEnum: PlayerCallupStatus에 DOCS_SUBMITTED 추가
ALTER TYPE "PlayerCallupStatus" ADD VALUE 'DOCS_SUBMITTED';

-- AlterEnum: NotificationType에 CALLUP_DOCS_READY 추가
ALTER TYPE "NotificationType" ADD VALUE 'CALLUP_DOCS_READY';

-- AlterTable: PlayerCallup에 boolean 필드 추가
ALTER TABLE "PlayerCallup" ADD COLUMN "youthCoachConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlayerCallup" ADD COLUMN "medicalConfirmed" BOOLEAN NOT NULL DEFAULT false;
