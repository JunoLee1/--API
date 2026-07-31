import { PrismaClient } from "../generated/client";

export class StaffRecordRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(includeInactive = false) {
    return this.prisma.staffRecord.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: number) {
    return this.prisma.staffRecord.findUnique({ where: { id } });
  }

  async create(data: {
    name: string;
    role: string;
    department?: string;
    phone?: string;
    notes?: string;
    createdById: number;
  }) {
    return this.prisma.staffRecord.create({ data });
  }

  async update(
    id: number,
    data: {
      name?: string;
      role?: string;
      department?: string;
      phone?: string;
      isActive?: boolean;
      notes?: string;
    }
  ) {
    return this.prisma.staffRecord.update({ where: { id }, data });
  }

  async delete(id: number) {
    return this.prisma.staffRecord.delete({ where: { id } });
  }
}
