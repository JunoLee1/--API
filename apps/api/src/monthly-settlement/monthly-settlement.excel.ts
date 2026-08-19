import ExcelJS from "exceljs";
import type { MonthlySettlementReport } from "../generated/client";

export async function generateSettlementExcel(report: MonthlySettlementReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const snapshot = report.snapshotJson as {
    revenue?: Record<string, number>;
    expenses?: Record<string, number>;
    budgetComparison?: Record<string, { budget: number; actual: number; variance: number }>;
    pnl?: { totalRevenue: number; totalExpense: number; netIncome: number };
  };

  // Sheet 1: 수익내역
  const sheet1 = wb.addWorksheet("수익내역");
  sheet1.addRow(["항목", "금액(원)"]);
  for (const [cat, amount] of Object.entries(snapshot.revenue ?? {})) {
    sheet1.addRow([cat, amount]);
  }
  sheet1.addRow(["합계", report.totalRevenue]);

  // Sheet 2: 운영비 예산 vs 실적
  const sheet2 = wb.addWorksheet("운영비실적");
  sheet2.addRow(["카테고리", "예산(원)", "실적(원)", "잔액(원)"]);
  for (const [cat, val] of Object.entries(snapshot.budgetComparison ?? {})) {
    sheet2.addRow([cat, val.budget, val.actual, val.variance]);
  }

  // Sheet 3: P&L 요약
  const sheet3 = wb.addWorksheet("P&L요약");
  sheet3.addRow(["항목", "금액(원)"]);
  sheet3.addRow(["총수익", report.totalRevenue]);
  sheet3.addRow(["총지출", report.totalExpense]);
  sheet3.addRow(["순이익", report.netIncome]);
  if (report.note) {
    sheet3.addRow([]);
    sheet3.addRow(["메모", report.note]);
  }

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}
