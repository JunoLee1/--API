import { api } from './api'
import type { OpsSnapshotData, BudgetSnapshotData, AnnualOpsEntry } from '@/types/ops-report'

export const opsReportApi = {
  getOpsKpi: (seasonId: number, year: number, month: number) =>
    api.get<OpsSnapshotData>(`/ops-reports/ops/kpi?seasonId=${seasonId}&year=${year}&month=${month}`),

  getAnnualOps: (seasonId: number) =>
    api.get<AnnualOpsEntry[]>(`/ops-reports/ops/annual?seasonId=${seasonId}`),

  getBudgetKpi: (seasonId: number, year: number, month: number) =>
    api.get<BudgetSnapshotData>(`/ops-reports/budget/kpi?seasonId=${seasonId}&year=${year}&month=${month}`),

  getAnnualBudget: (seasonId: number) =>
    api.get<BudgetSnapshotData[]>(`/ops-reports/budget/annual?seasonId=${seasonId}`),
}
