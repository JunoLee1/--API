import cron from "node-cron";
import { OperatingExpenseRepository } from "../operating-expense/operating-expense.repo";
import { getPrisma } from "../lib/prisma";

export function startOpexPurgeJob() {
  // 매월 1일 새벽 2시 — soft-delete 후 10년 경과분 hard-delete
  cron.schedule("0 2 1 * *", async () => {
    const repo = new OperatingExpenseRepository(getPrisma());
    await repo.purgeExpired();
  });
}
