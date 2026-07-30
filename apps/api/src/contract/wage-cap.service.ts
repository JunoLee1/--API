import { PrismaClient } from "../generated/client";

export type WageCapCheckResult =
  | { status: "OK" }
  | { status: "WARNING"; percentOver: number }
  | { status: "BLOCKED"; percentOver: number };

export class WageCapService {
  constructor(private prisma: PrismaClient) {}

  async check(
    newSalary: number,
    contractStartDate: Date,
    contractEndDate: Date,
  ): Promise<WageCapCheckResult> {
    const season = await this.prisma.season.findFirst({
      where: { status: "ACTIVE" },
      select: { wageCapType: true, wageCapValue: true, startDate: true, endDate: true },
    });

    if (!season || !season.wageCapType || season.wageCapValue == null) {
      return { status: "OK" };
    }

    if (season.wageCapType === "RATIO") {
      return { status: "OK" };
    }

    const activeContracts = await this.prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: season.endDate },
        endDate: { gte: season.startDate },
      },
      select: { salary: true },
    });

    const totalSalary = activeContracts.reduce((sum, c) => sum + c.salary, 0);
    const projected = totalSalary + newSalary;
    const cap = season.wageCapValue;

    if (projected <= cap) return { status: "OK" };

    const percentOver = ((projected - cap) / cap) * 100;
    if (percentOver <= 10) return { status: "WARNING", percentOver };
    return { status: "BLOCKED", percentOver };
  }
}
