-- AlterColumn: MealExpense.amount Float -> Int (precision-safe for monetary values)
ALTER TABLE "MealExpense" ALTER COLUMN "amount" TYPE INTEGER USING "amount"::integer;
