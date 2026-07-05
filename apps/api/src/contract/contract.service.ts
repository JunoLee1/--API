import { ContractRepository } from "./contract.repo";
import { AppError } from "../lib/appError";
import {
  CreateContractDto,
  UpdateContractStatusDto,
  CreateBuyoutDto,
  CreateExtensionDto,
  CreateBonusDto,
} from "./dto/contract.dto";

export class ContractService {
  constructor(private repo: ContractRepository) {}

  getContractsByPlayer(playerId: string) {
    return this.repo.findByPlayerId(playerId);
  }

  async getContractById(id: number) {
    const contract = await this.repo.findById(id);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    return contract;
  }

  createContract(dto: CreateContractDto) {
    return this.repo.create(dto);
  }

  async updateStatus(id: number, dto: UpdateContractStatusDto) {
    const contract = await this.repo.findById(id);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
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
