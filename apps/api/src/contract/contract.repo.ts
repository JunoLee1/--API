import { PrismaClient } from "../generated/client";
import { ContractStatus } from "../generated/enums";
import {
  CreateContractDto,
  CreateBuyoutDto,
  CreateExtensionDto,
  CreateBonusDto,
} from "./dto/contract.dto";

const CONTRACT_DETAIL = {
  id: true,
  startDate: true,
  endDate: true,
  salary: true,
  status: true,
  playerId: true,
  managedById: true,
  agencyId: true,
  agencyCommission: true,
  buyoutClause: true,
  extensionOptions: true,
  performanceBonuses: {
    include: { triggers: true },
  },
} as const;

export class ContractRepository {
  constructor(private prisma: PrismaClient) {}

  findByPlayerId(playerId: string) {
    return this.prisma.contract.findMany({
      where: { playerId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        salary: true,
        status: true,
        managedById: true,
      },
      orderBy: { startDate: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.contract.findUnique({
      where: { id },
      select: CONTRACT_DETAIL,
    });
  }

  create(dto: CreateContractDto) {
    return this.prisma.contract.create({
      data: {
        playerId: dto.playerId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        salary: dto.salary,
        ...(dto.managedById && { managedById: dto.managedById }),
        ...(dto.agencyId && { agencyId: dto.agencyId }),
        ...(dto.agencyCommission !== undefined && { agencyCommission: dto.agencyCommission }),
      },
      select: CONTRACT_DETAIL,
    });
  }

  updateStatus(id: number, status: ContractStatus) {
    return this.prisma.contract.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }

  createBuyout(contractId: number, dto: CreateBuyoutDto) {
    return this.prisma.buyoutClause.create({
      data: { contractId, amount: dto.amount },
    });
  }

  createExtension(contractId: number, dto: CreateExtensionDto) {
    return this.prisma.extensionOption.create({
      data: {
        contractId,
        condition: dto.condition,
        durationMonths: dto.durationMonths,
      },
    });
  }

  createBonus(contractId: number, dto: CreateBonusDto) {
    return this.prisma.performanceBonus.create({
      data: {
        contractId,
        amount: dto.amount,
        description: dto.description,
        triggers: {
          create: dto.triggers.map((t) => ({
            metric: t.metric,
            threshold: t.threshold,
            period: t.period,
            ...(t.competitionType && { competitionType: t.competitionType }),
          })),
        },
      },
      include: { triggers: true },
    });
  }

  hasBuyout(contractId: number) {
    return this.prisma.buyoutClause.findUnique({
      where: { contractId },
      select: { id: true },
    });
  }
}
