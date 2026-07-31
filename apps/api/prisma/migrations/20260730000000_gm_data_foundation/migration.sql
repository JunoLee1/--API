-- AlterEnum: Add FINANCE_MANAGER to FrontOfficeRole
ALTER TYPE "FrontOfficeRole" ADD VALUE IF NOT EXISTS 'FINANCE_MANAGER';

-- CreateEnum: WageCapType
CREATE TYPE "WageCapType" AS ENUM ('FIXED', 'RATIO');

-- CreateEnum: MealExpenseType
CREATE TYPE "MealExpenseType" AS ENUM ('TRAINING', 'MATCH');

-- AlterTable: Season - add wageCapType and wageCapValue
ALTER TABLE "Season" ADD COLUMN "wageCapType" "WageCapType";
ALTER TABLE "Season" ADD COLUMN "wageCapValue" DOUBLE PRECISION;

-- AlterTable: Player - add allergies and foodPreferences
ALTER TABLE "Player" ADD COLUMN "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Player" ADD COLUMN "foodPreferences" TEXT;

-- CreateTable: ClubSettings
CREATE TABLE "ClubSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'KRW',

    CONSTRAINT "ClubSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClubSettings_singleton" CHECK ("id" = 1)
);

-- CreateTable: StaffRecord
CREATE TABLE "StaffRecord" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MealExpense
CREATE TABLE "MealExpense" (
    "id" SERIAL NOT NULL,
    "type" "MealExpenseType" NOT NULL,
    "sessionId" INTEGER,
    "matchId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "restaurantName" TEXT,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealExpense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: StaffRecord.createdById -> User.id
ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: MealExpense.sessionId -> TrainingSession.id
ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: MealExpense.matchId -> Match.id
ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: MealExpense.createdById -> User.id
ALTER TABLE "MealExpense" ADD CONSTRAINT "MealExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
