import { api } from './api'
import type { OpsSnapshotData, BudgetSnapshotData, AnnualOpsEntry, NoticeUnreadDrillItem, AttendanceDrillItem } from '@/types/ops-report'

export const opsReportApi = {
  getOpsKpi: (seasonId: number, year: number, month: number) =>
    api.get<OpsSnapshotData>(`/ops-reports/ops/kpi?seasonId=${seasonId}&year=${year}&month=${month}`),

  getAnnualOps: (seasonId: number) =>
    api.get<AnnualOpsEntry[]>(`/ops-reports/ops/annual?seasonId=${seasonId}`),

  getBudgetKpi: (seasonId: number, year: number, month: number) =>
    api.get<BudgetSnapshotData>(`/ops-reports/budget/kpi?seasonId=${seasonId}&year=${year}&month=${month}`),

  getAnnualBudget: (seasonId: number) =>
    api.get<BudgetSnapshotData[]>(`/ops-reports/budget/annual?seasonId=${seasonId}`),

  getDrillNoticeUnread: (year: number, month: number) =>
    api.get<NoticeUnreadDrillItem[]>(`/ops-reports/drill/notice-unread?year=${year}&month=${month}`),

  getDrillAttendance: (year: number, month: number) =>
    api.get<AttendanceDrillItem[]>(`/ops-reports/drill/attendance?year=${year}&month=${month}`),
}
