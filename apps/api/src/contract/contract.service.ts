import { ContractRepository } from "./contract.repo";
import { WageCapService } from "./wage-cap.service";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
import { getPrisma } from "../lib/prisma";
import {
  CreateContractDto,
  UpdateContractStatusDto,
  CreateBuyoutDto,
  CreateExtensionDto,
  CreateBonusDto,
} from "./dto/contract.dto";

export class ContractService {
  constructor(
    private repo: ContractRepository,
    private wageCapService: WageCapService,
  ) {}

  getContractsByPlayer(playerId: string) {
    return this.repo.findByPlayerId(playerId);
  }

  async getContractById(id: number) {
    const contract = await this.repo.findById(id);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    return contract;
  }

  async createContract(dto: CreateContractDto, actorId: number) {
    if (dto.salary <= 0) throw new AppError(400, "INVALID_SALARY");

    const player = await getPrisma().player.findUnique({
      where: { id: dto.playerId },
      select: { status: true },
    });
    if (player?.status === "RELEASED") {
      throw new AppError(409, "PLAYER_RELEASED_CANNOT_CONTRACT");
    }

    const capResult = await this.wageCapService.check(dto.salary);

    if (capResult.status === "BLOCKED") {
      throw new AppError(400, "WAGE_CAP_EXCEEDED");
    }

    const contract = await this.repo.create(dto);

    await writeAuditLog({
      actorId,
      action: "CONTRACT_CREATED",
      targetId: contract.id,
      detail: { playerId: dto.playerId, salary: dto.salary, startDate: dto.startDate, endDate: dto.endDate },
    });

    if (capResult.status === "WARNING") {
      return { ...contract, wageCapWarning: { percentOver: capResult.percentOver } };
    }

    return contract;
  }

  async updateStatus(id: number, dto: UpdateContractStatusDto, actorId: number) {
    const contract = await this.repo.findById(id);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    const updated = await this.repo.updateStatus(id, dto.status);
    await writeAuditLog({
      actorId,
      action: "CONTRACT_STATUS_CHANGED",
      targetId: id,
      detail: { before: contract.status, after: dto.status },
    });
    return updated;
  }

  async addBuyout(contractId: number, dto: CreateBuyoutDto, actorId: number) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    const existing = await this.repo.hasBuyout(contractId);
    if (existing) throw new AppError(409, "BUYOUT_ALREADY_EXISTS");
    const buyout = await this.repo.createBuyout(contractId, dto);
    await writeAuditLog({
      actorId,
      action: "CONTRACT_BUYOUT_ADDED",
      targetId: contractId,
      detail: { amount: dto.amount },
    });
    return buyout;
  }

  async addExtension(contractId: number, dto: CreateExtensionDto, actorId: number) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    const extension = await this.repo.createExtension(contractId, dto);
    await writeAuditLog({
      actorId,
      action: "CONTRACT_EXTENSION_ADDED",
      targetId: contractId,
      detail: { condition: dto.condition, durationMonths: dto.durationMonths },
    });
    return extension;
  }

  async addBonus(contractId: number, dto: CreateBonusDto, actorId: number) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    const bonus = await this.repo.createBonus(contractId, dto);
    await writeAuditLog({
      actorId,
      action: "CONTRACT_BONUS_ADDED",
      targetId: contractId,
      detail: { amount: dto.amount, description: dto.description },
    });
    return bonus;
  }

  getSquadSalaryOverview() {
    return this.repo.getSquadSalaryByPosition();
  }

  getExpiringContractsWithValue(days?: number) {
    return this.repo.getContractExpirySoonWithMarketValue(days);
  }

  getTransferPnL() {
    return this.repo.getTransferPnL();
  }

  getSalaryBenchmark() {
    return this.repo.getSalaryBenchmarkByLevel();
  }

  getProspectSummary() {
    return this.repo.getProspectCostSummary();
  }
}
