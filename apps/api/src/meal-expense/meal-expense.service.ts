import { MealExpenseType } from "../generated/client";
import { MealExpenseRepository } from "./meal-expense.repo";
import { AppError } from "../lib/appError";

export class MealExpenseService {
  constructor(private repo: MealExpenseRepository) {}

  async list(filters: { type?: MealExpenseType; from?: string; to?: string }) {
    const repoFilters: { type?: MealExpenseType; from?: Date; to?: Date } = {};
    if (filters.type) repoFilters.type = filters.type;
    if (filters.from) repoFilters.from = new Date(filters.from);
    if (filters.to) repoFilters.to = new Date(filters.to);
    return this.repo.findAll(repoFilters);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "MEAL_EXPENSE_NOT_FOUND");
    return record;
  }

  async create(
    data: {
      type: MealExpenseType;
      sessionId?: number;
      matchId?: number;
      date: string;
      amount: number;
      restaurantName?: string;
      note?: string;
    },
    createdById: number,
  ) {
    if (data.type === "TRAINING" && !data.sessionId)
      throw new Error("sessionId required for TRAINING type");
    if (data.type === "MATCH" && !data.matchId)
      throw new Error("matchId required for MATCH type");
    return this.repo.create({ ...data, date: new Date(data.date), createdById });
  }

  async update(id: number, data: { amount?: number; restaurantName?: string; note?: string }) {
    await this.get(id);
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    await this.get(id);
    return this.repo.delete(id);
  }
}
