import type { PrismaClient } from "../generated/client";
import type { CreateSalesRecordDto } from "./dto/sales.dto";

export class SalesRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.salesRecord.findMany({ orderBy: { saleDate: "desc" } });
  }

  create(data: CreateSalesRecordDto & { totalAmount: number; createdById: number }) {
    return this.prisma.salesRecord.create({
      data: {
        type: data.type,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalAmount: data.totalAmount,
        currency: data.currency ?? "KRW",
        saleDate: new Date(data.saleDate),
        ...(data.description && { description: data.description }),
        createdById: data.createdById,
      },
    });
  }

  groupByType() {
    return this.prisma.salesRecord.groupBy({
      by: ["type"],
      _sum: { totalAmount: true },
    });
  }
}
