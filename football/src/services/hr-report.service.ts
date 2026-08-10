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
  extractImage: async (file: File, period: "monthly" | "annual"): Promise<Record<string, unknown>> => {
    const form = new FormData();
    form.append("image", file);
    form.append("period", period);
    const { data } = await api.post("/hr-reports/extract-image", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
