import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { OpsReportRepository } from "../ops-report/ops-report.repo";
import { OpsReportService } from "../ops-report/ops-report.service";

export async function runMonthlyBudgetReport() {
  const prisma = getPrisma();
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();

  const seasons = await prisma.season.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  const repo = new OpsReportRepository(prisma);
  const service = new OpsReportService(repo, prisma);

  for (const season of seasons) {
    const { snapshotData, totalBudget, totalActual } = await service.computeBudgetSnapshot(season.id, year, month);
    await repo.upsertBudgetSnapshot(season.id, year, month, snapshotData, totalBudget, totalActual);
  }
}

export function startMonthlyBudgetReportJob() {
  cron.schedule("0 0 1 * *", () => { runMonthlyBudgetReport().catch(console.error); });
}
