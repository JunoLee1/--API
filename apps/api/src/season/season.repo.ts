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

  async updateWageCap(id: number, wageCapType: string | null, wageCapValue: number | null) {
    return await this.prisma.season.update({
      where: { id },
      data: { wageCapType: wageCapType as any, wageCapValue },
    });
  }

  async findActiveWithKPI() {
    const season = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
      include: { financialReport: { select: { totalRevenue: true } } },
    });
    if (!season) return null;

    const contracts = await this.prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: season.endDate },
        endDate: { gte: season.startDate },
      },
      select: { salary: true },
    });

    const totalPayroll = contracts.reduce((sum, c) => sum + c.salary, 0);
    const totalRevenue = season.financialReport?.totalRevenue ?? null;

    let cap: number | null = null;
    if (season.wageCapType === "FIXED" && season.wageCapValue != null) {
      cap = season.wageCapValue;
    } else if (season.wageCapType === "RATIO" && season.wageCapValue != null && totalRevenue != null) {
      cap = Math.round(totalRevenue * season.wageCapValue);
    }

    return {
      wageCapType: season.wageCapType,
      wageCapValue: season.wageCapValue,
      totalRevenue,
      cap,
      totalPayroll,
      percentUsed: cap != null ? Math.round((totalPayroll / cap) * 1000) / 10 : null,
      remaining: cap != null ? cap - totalPayroll : null,
    };
  }
}
