-- Step 1: MealExpense 데이터를 OperatingExpense(MEAL)로 이전
INSERT INTO "OperatingExpense" ("seasonId", "category", "amount", "date", "note", "createdById", "createdAt", "updatedAt")
SELECT
  s.id AS "seasonId",
  'MEAL'::"OperatingCategory",
  m."amount",
  m."date",
  m."note",
  m."createdById",
  m."createdAt",
  m."updatedAt"
FROM "MealExpense" m
JOIN "Season" s ON m."date" >= s."startDate" AND m."date" <= s."endDate";

-- Step 2: MealExpense 테이블 drop
DROP TABLE IF EXISTS "MealExpense";

-- Step 3: MealExpenseType enum drop
DROP TYPE IF EXISTS "MealExpenseType";
