import { api } from "./api";

export type MealExpenseType = "TRAINING" | "MATCH";

export interface MealExpense {
  id: number;
  type: MealExpenseType;
  sessionId: number | null;
  matchId: number | null;
  date: string;
  amount: number;
  restaurantName: string | null;
  note: string | null;
  createdById: number;
  createdAt: string;
  createdBy: { id: number; username: string };
}

export const mealExpenseApi = {
  list: (params?: { type?: MealExpenseType; from?: string; to?: string }): Promise<MealExpense[]> => {
    const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][];
    const qs = new URLSearchParams(entries).toString();
    return api.get(`/meal-expenses${qs ? `?${qs}` : ""}`);
  },
  get: (id: number): Promise<MealExpense> => api.get(`/meal-expenses/${id}`),
  create: (
    data: Pick<MealExpense, "type" | "date" | "amount"> & {
      sessionId?: number;
      matchId?: number;
      restaurantName?: string;
      note?: string;
    },
  ): Promise<MealExpense> => api.post("/meal-expenses", data),
  update: (
    id: number,
    data: Partial<Pick<MealExpense, "amount" | "restaurantName" | "note">>,
  ): Promise<MealExpense> => api.patch(`/meal-expenses/${id}`, data),
  delete: (id: number): Promise<void> => api.delete(`/meal-expenses/${id}`),
};
