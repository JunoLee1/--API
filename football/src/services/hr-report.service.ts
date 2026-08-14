import { api } from "./api";
import type { HrMonthlyReport, HrAnnualReport } from "@/types/hr-report";

export const hrReportApi = {
  monthly: (year: number, month: number): Promise<HrMonthlyReport> =>
    api.get(`/hr-reports/monthly?year=${year}&month=${month}`),

  annual: (year: number): Promise<HrAnnualReport> =>
    api.get(`/hr-reports/annual?year=${year}`),

  extractImage: async (file: File, period: "monthly" | "annual"): Promise<Record<string, unknown>> => {
    const form = new FormData();
    form.append("image", file);
    form.append("period", period);
    return api.post("/hr-reports/extract-image", form);
  },
};
