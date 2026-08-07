import { ContractRepository } from "./contract.repo";
import { WageCapService } from "./wage-cap.service";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
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

    const capResult = await this.wageCapService.check(dto.salary);

    if (capResult.status === "BLOCKED") {
      throw new AppError(400, "WAGE_CAP_EXCEEDED");
    }

    const contract = await this.repo.create(dto);
    await writeAuditLog({ actorId, action: "CONTRACT_CREATED", targetId: contract.id, detail: { playerId: dto.playerId } });

    if (capResult.status === "WARNING") {
      return { ...contract, wageCapWarning: { percentOver: capResult.percentOver } };
    }

    return contract;
  }

  async updateStatus(id: number, dto: UpdateContractStatusDto, actorId: number) {
    const contract = await this.repo.findById(id);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    await writeAuditLog({ actorId, action: "CONTRACT_STATUS_UPDATED", targetId: id, detail: { status: dto.status } });
    return this.repo.updateStatus(id, dto.status);
  }

  async addBuyout(contractId: number, dto: CreateBuyoutDto) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    const existing = await this.repo.hasBuyout(contractId);
    if (existing) throw new AppError(409, "BUYOUT_ALREADY_EXISTS");
    return this.repo.createBuyout(contractId, dto);
  }

  async addExtension(contractId: number, dto: CreateExtensionDto) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    return this.repo.createExtension(contractId, dto);
  }

  async addBonus(contractId: number, dto: CreateBonusDto) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    return this.repo.createBonus(contractId, dto);
  }
}
