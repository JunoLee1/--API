import { PrismaClient } from "../generated/client";

export class ExpenseCategoryRepository {
  constructor(private prisma: PrismaClient) {}

  listActive() {
    return this.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  listAll() {
    return this.prisma.expenseCategory.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  findByCode(code: string) {
    return this.prisma.expenseCategory.findUnique({ where: { code } });
  }
}
