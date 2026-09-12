export interface CreateOperatingExpenseDto {
  seasonId: number;
  category: string;
  costType?: "FIXED" | "VARIABLE" | "CONTINGENCY";
  amount: number;
  date: string;
  note?: string;
  createdById: number;
  budgetLineId?: number;
  actorClubId?: number | null | undefined;
}

export interface UpdateOperatingExpenseDto {
  amount?: number;
  category?: string;
  note?: string;
}
