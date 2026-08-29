-- CreateEnum
CREATE TYPE "CategoryScope" AS ENUM ('TEAM', 'DEPARTMENT');

-- AlterTable — ExpenseCategory 에 scope 추가, 기존 레코드는 DEPARTMENT 로 backfill
ALTER TABLE "ExpenseCategory"
  ADD COLUMN "scope" "CategoryScope" NOT NULL DEFAULT 'DEPARTMENT';

-- Seed — TEAM 스코프 예시 카테고리 신설 (편성 워크플로우 준비)
INSERT INTO "ExpenseCategory" ("code", "label", "sortOrder", "isActive", "scope", "updatedAt") VALUES
  ('HOME_MATCH_SUPPORT', '홈경기 현장지원', 10, true, 'TEAM',       NOW()),
  ('AWAY_TRAVEL_TEAM',   '원정 이동·숙박', 11, true, 'TEAM',       NOW()),
  ('TEAM_TRAINING_GEAR', '팀별 훈련용품',  12, true, 'TEAM',       NOW())
ON CONFLICT ("code") DO NOTHING;
