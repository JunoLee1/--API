import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { OpsReportRepository } from "../ops-report/ops-report.repo";
import { OpsReportService } from "../ops-report/ops-report.service";

export async function runMonthlyOperationsReport() {
  const prisma = getPrisma();
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // 전월

  const seasons = await prisma.season.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  const repo = new OpsReportRepository(prisma);
  const service = new OpsReportService(repo, prisma);

  for (const season of seasons) {
    const data = await service.computeOpsKpi(season.id, year, month);
    await repo.upsertOpsSnapshot(season.id, year, month, data);
  }
}

export function startMonthlyOperationsReportJob() {
  cron.schedule("0 0 1 * *", () => { runMonthlyOperationsReport().catch(console.error); });
}
