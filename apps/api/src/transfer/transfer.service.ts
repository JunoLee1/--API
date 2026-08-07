import { TransferRepository } from "./transfer.repo";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
import { CreateTransferDto, CreateRecallDto, UpdateRecallStatusDto } from "./dto/transfer.dto";
import { RecallStatus } from "../generated/enums";

export class TransferService {
  constructor(private repo: TransferRepository) {}

  getByPlayer(playerId: string) {
    return this.repo.findByPlayer(playerId);
  }

  async getById(id: number) {
    const transfer = await this.repo.findById(id);
    if (!transfer) throw new AppError(404, "TRANSFER_NOT_FOUND");
    return transfer;
  }

  async createTransfer(dto: CreateTransferDto, actorId: number) {
    const transfer = await this.repo.createTransfer(dto);
    await writeAuditLog({ actorId, action: "TRANSFER_CREATED", targetId: transfer.id, detail: { playerId: dto.playerId, type: dto.type } });
    return transfer;
  }

  getRecalls(status?: RecallStatus) {
    return this.repo.findRecallsByStatus(status);
  }

  async createRecall(dto: CreateRecallDto, requestedById: number) {
    const transfer = await this.repo.findById(dto.transferId);
    if (!transfer) throw new AppError(404, "TRANSFER_NOT_FOUND");
    if (transfer.recall) throw new AppError(409, "RECALL_ALREADY_EXISTS");
    return this.repo.createRecall(dto, requestedById);
  }

  async updateRecallStatus(id: number, dto: UpdateRecallStatusDto, approvedById: number) {
    const recall = await this.repo.findRecallById(id);
    if (!recall) throw new AppError(404, "RECALL_NOT_FOUND");
    if (recall.status !== RecallStatus.PENDING) throw new AppError(409, "RECALL_ALREADY_PROCESSED");
    return this.repo.updateRecallStatus(id, dto.status, approvedById);
  }

  async exportLoanIn(transferId: number) {
    const data = await this.repo.exportLoanInData(transferId);
    if (!data) throw new AppError(404, "TRANSFER_NOT_FOUND_OR_NOT_LOAN_IN");
    return data;
  }
}
