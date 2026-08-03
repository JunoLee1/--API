import type { PrismaClient } from "../../generated/client";
import type { PayrollCountry } from "../../generated/enums";
import type { CreatePayrollConfigDto, UpdatePayrollConfigDto, PayrollConfigListQuery } from "./dto/config.dto";

export class ConfigRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: PayrollConfigListQuery) {
    return this.prisma.payrollConfig.findMany({
      where: { ...(query.country && { country: query.country }) },
      orderBy: [{ country: "asc" }, { insuranceType: "asc" }, { effectiveFrom: "desc" }],
    });
  }

  findById(id: number) {
    return this.prisma.payrollConfig.findUnique({ where: { id } });
  }

  create(data: CreatePayrollConfigDto) {
    return this.prisma.payrollConfig.create({
      data: {
        country: data.country,
        insuranceType: data.insuranceType,
        employeeRate: data.employeeRate,
        employerRate: data.employerRate,
        effectiveFrom: new Date(data.effectiveFrom),
      },
    });
  }

  update(id: number, data: UpdatePayrollConfigDto) {
    return this.prisma.payrollConfig.update({ where: { id }, data });
  }

  findActiveForCountry(country: PayrollCountry, month: Date) {
    return this.prisma.payrollConfig
      .findMany({
        where: { country, effectiveFrom: { lte: month } },
        orderBy: { effectiveFrom: "desc" },
      })
      .then((all) => {
        const seen = new Set<string>();
        return all.filter((c) => {
          if (seen.has(c.insuranceType)) return false;
          seen.add(c.insuranceType);
          return true;
        });
      });
  }
}
