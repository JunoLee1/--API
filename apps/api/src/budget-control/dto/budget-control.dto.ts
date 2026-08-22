export interface CreateBudgetHeaderDto {
  seasonId: number;
  name: string;
  totalBudget: number;
  note?: string;
}

export interface UpdateBudgetHeaderDto {
  name?: string;
  totalBudget?: number;
  note?: string;
}

import { OperatingCategory } from "../../generated/client";

export interface CreateBudgetLineDto {
  departmentId?: number;
  category: OperatingCategory;
  year: number;
  month?: number;
  originalAmount: number;
  note?: string;
}

export interface UpdateBudgetLineDto {
  originalAmount?: number;
  note?: string;
}

export interface CreateAdjustmentDto {
  type: 'CARRYOVER' | 'INCREASE' | 'DECREASE' | 'TRANSFER';
  amount: number;
  fromLineId?: number;
  toLineId?: number;
  reason: string;
}
