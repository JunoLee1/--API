import { PrismaClient, MealExpenseType } from "../generated/client";

export class MealExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(filters: { type?: MealExpenseType; from?: Date; to?: Date } = {}) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filters.from) dateFilter.gte = filters.from;
    if (filters.to) dateFilter.lte = filters.to;
    const hasDates = filters.from !== undefined || filters.to !== undefined;

    return this.prisma.mealExpense.findMany({
      where: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(hasDates ? { date: dateFilter } : {}),
      },
      include: { createdBy: { select: { id: true, username: true } } },
      orderBy: { date: "desc" },
    });
  }

  async findById(id: number) {
    return this.prisma.mealExpense.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }

  async create(data: {
    type: MealExpenseType;
    sessionId?: number;
    matchId?: number;
    date: Date;
    amount: number;
    restaurantName?: string;
    note?: string;
    createdById: number;
  }) {
    return this.prisma.mealExpense.create({ data });
  }

  async update(id: number, data: {
    amount?: number;
    restaurantName?: string;
    note?: string;
  }) {
    return this.prisma.mealExpense.update({ where: { id }, data });
  }

  async delete(id: number) {
    return this.prisma.mealExpense.delete({ where: { id } });
  }
}
