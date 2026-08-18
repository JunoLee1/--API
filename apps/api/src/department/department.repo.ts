import { PrismaClient } from "../generated/client";
import type { DepartmentCategory } from "../generated/enums";

export class DepartmentRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(clubId?: number | null) {
    return this.prisma.department.findMany({
      where: { parentId: null, ...(clubId != null && { clubId }) },
      orderBy: { name: "asc" },
      include: { children: { orderBy: { name: "asc" } } },
    });
  }

  findById(id: number) {
    return this.prisma.department.findUnique({
      where: { id },
      include: { children: { orderBy: { name: "asc" } }, parent: true },
    });
  }

  findByName(name: string, clubId?: number | null) {
    return this.prisma.department.findUnique({
      where: { name_clubId: { name, clubId: clubId ?? (null as unknown as number) } },
    });
  }

  create(data: { name: string; parentId?: number; category?: DepartmentCategory | null; clubId?: number | null }) {
    return this.prisma.department.create({
      data,
      include: { children: { orderBy: { name: "asc" } }, parent: true },
    });
  }

  update(id: number, data: { name?: string; isActive?: boolean; parentId?: number | null; category?: DepartmentCategory | null }) {
    return this.prisma.department.update({
      where: { id },
      data,
      include: { children: { orderBy: { name: "asc" } }, parent: true },
    });
  }

  countActiveStaff(departmentId: number) {
    return this.prisma.staffRecord.count({ where: { departmentId, isActive: true } });
  }

  delete(id: number) {
    return this.prisma.department.delete({ where: { id } });
  }
}
