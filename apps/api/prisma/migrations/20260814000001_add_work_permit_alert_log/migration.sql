-- CreateTable
CREATE TABLE "WorkPermitAlertLog" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkPermitAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkPermitAlertLog_playerId_window_key" ON "WorkPermitAlertLog"("playerId", "window");

-- AddForeignKey
ALTER TABLE "WorkPermitAlertLog" ADD CONSTRAINT "WorkPermitAlertLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WORK_PERMIT_EXPIRY_SOON_60D';
