import { PrismaClient } from "../generated/client";

export class HospitalRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.hospital.findMany({
      select: { id: true, name: true, address: true, phone: true },
      orderBy: { name: "asc" },
    });
  }

  create(data: { name: string; address?: string; phone?: string }) {
    return this.prisma.hospital.create({
      data,
      select: { id: true, name: true, address: true, phone: true },
    });
  }
}
