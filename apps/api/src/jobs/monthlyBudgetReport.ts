import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { OpsReportRepository } from "../ops-report/ops-report.repo";
import { OpsReportService } from "../ops-report/ops-report.service";
import { MonthlySettlementRepository } from "../monthly-settlement/monthly-settlement.repo";
import { MonthlySettlementService } from "../monthly-settlement/monthly-settlement.service";

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

export async function generateMonthlySettlementDraft() {
  const prisma = getPrisma();
  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (!activeSeason) return;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) return;

  const repo = new MonthlySettlementRepository(prisma);
  const service = new MonthlySettlementService(repo, prisma);
  await service.generate(activeSeason.id, prevYear, prevMonth, admin.id);
  console.log(`✅ 월말 결산 초안 자동 생성: ${prevYear}년 ${prevMonth}월`);
}

export function startMonthlyBudgetReportJob() {
  cron.schedule("0 0 1 * *", () => {
    runMonthlyBudgetReport().catch(console.error);
    generateMonthlySettlementDraft().catch(console.error);
  });
}
