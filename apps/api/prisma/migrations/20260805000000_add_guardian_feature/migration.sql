-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'GUARDIAN_CHILD_INJURY';
ALTER TYPE "NotificationType" ADD VALUE 'GUARDIAN_CHILD_CALLUP';

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "studentCode" TEXT;

-- AlterTable
ALTER TABLE "PlayerCallup" ADD COLUMN "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "GuardianInviteCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "issuedById" INTEGER NOT NULL,
    "usedById" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianInviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardianInviteCode_code_key" ON "GuardianInviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Player_studentCode_key" ON "Player"("studentCode");

-- AddForeignKey
ALTER TABLE "GuardianInviteCode" ADD CONSTRAINT "GuardianInviteCode_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInviteCode" ADD CONSTRAINT "GuardianInviteCode_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInviteCode" ADD CONSTRAINT "GuardianInviteCode_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
