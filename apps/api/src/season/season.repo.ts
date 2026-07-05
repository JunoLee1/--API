import { PrismaClient, SeasonStatus } from "../generated/client";

export class SeasonRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: { name: string; startDate: Date; endDate: Date }) {
    return await this.prisma.season.create({ data });
  }

  async findById(id: number) {
    return await this.prisma.season.findUnique({
      where: { id },
      include: { _count: { select: { matches: true, trainingSessions: true } } },
    });
  }

  async findAll(status?: SeasonStatus) {
    return await this.prisma.season.findMany({
      ...(status !== undefined && { where: { status } }),
      orderBy: { startDate: "desc" },
    });
  }

  async findActive() {
    return await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
    });
  }

  async updateStatus(id: number, status: SeasonStatus) {
    return await this.prisma.season.update({
      where: { id },
      data: { status },
    });
  }
}
