import { PrismaClient } from "../generated/client";

export class DepartmentRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: "asc" } });
  }

  findById(id: number) {
    return this.prisma.department.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.department.findUnique({ where: { name } });
  }

  create(data: { name: string }) {
    return this.prisma.department.create({ data });
  }

  update(id: number, data: { name?: string; isActive?: boolean }) {
    return this.prisma.department.update({ where: { id }, data });
  }

  delete(id: number) {
    return this.prisma.department.delete({ where: { id } });
  }
}
