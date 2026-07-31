import { api } from "./api";
import type { HrMonthlyReport, HrAnnualReport } from "@/types/hr-report";

export const hrReportApi = {
  monthly: async (year: number, month: number): Promise<HrMonthlyReport> => {
    const { data } = await api.get("/hr-reports/monthly", { params: { year, month } });
    return data;
  },
  annual: async (year: number): Promise<HrAnnualReport> => {
    const { data } = await api.get("/hr-reports/annual", { params: { year } });
    return data;
  },
};
