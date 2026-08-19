import { AppError } from "../lib/appError";
import type { BudgetControlRepository } from "./budget-control.repo";
import type { CreateBudgetHeaderDto, UpdateBudgetHeaderDto, CreateBudgetLineDto, UpdateBudgetLineDto, CreateAdjustmentDto } from "./dto/budget-control.dto";

export class BudgetControlService {
  constructor(private repo: BudgetControlRepository) {}

  async create(dto: CreateBudgetHeaderDto, createdById: number) {
    if (dto.totalBudget < 0) throw new AppError(400, "INVALID_BUDGET");
    return this.repo.createHeader(dto, createdById);
  }

  getAll(seasonId?: number) {
    return this.repo.findAll(seasonId);
  }

  async getById(id: number) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    return header;
  }

  async update(id: number, dto: UpdateBudgetHeaderDto) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    return this.repo.updateHeader(id, dto);
  }

  async submit(id: number, userId: number) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    if (header.totalBudget <= 0) throw new AppError(400, "BUDGET_AMOUNT_REQUIRED");
    return this.repo.updateStatus(id, "SUBMITTED");
  }

  async approve(id: number, approverId: number) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status !== "SUBMITTED") throw new AppError(400, "BUDGET_NOT_SUBMITTED");
    return this.repo.updateStatus(id, "APPROVED", approverId);
  }

  async getAvailableBudget(id: number) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");

    const adjSums = await this.repo.sumApprovedAdjustments(id);
    const byType = Object.fromEntries(adjSums.map(r => [r.type, r._sum.amount ?? 0]));

    const approvedBudget = header.totalBudget;
    const carryover = byType["CARRYOVER"] ?? 0;
    const increase = byType["INCREASE"] ?? 0;
    const decrease = byType["DECREASE"] ?? 0;
    const available = approvedBudget + carryover + increase - decrease;

    return {
      headerId: id,
      status: header.status,
      approvedBudget,
      carryover,
      increase,
      decrease,
      commitment: 0,
      actual: 0,
      available,
    };
  }

  async addLine(headerId: number, dto: CreateBudgetLineDto) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    return this.repo.createLine(headerId, dto);
  }

  async updateLine(headerId: number, lineId: number, dto: UpdateBudgetLineDto) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    const line = header.lines.find(l => l.id === lineId);
    if (!line) throw new AppError(404, "BUDGET_LINE_NOT_FOUND");
    return this.repo.updateLine(lineId, dto);
  }

  async deleteLine(headerId: number, lineId: number) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    const line = header.lines.find(l => l.id === lineId);
    if (!line) throw new AppError(404, "BUDGET_LINE_NOT_FOUND");
    return this.repo.deleteLine(lineId);
  }

  async requestAdjustment(headerId: number, dto: CreateAdjustmentDto, createdById: number) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "DRAFT") throw new AppError(400, "BUDGET_NOT_APPROVED");
    if (dto.amount <= 0) throw new AppError(400, "INVALID_ADJUSTMENT_AMOUNT");
    return this.repo.createAdjustment(headerId, dto, createdById);
  }

  async approveAdjustment(headerId: number, adjId: number, approverId: number) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    const adj = header.adjustments.find(a => a.id === adjId);
    if (!adj) throw new AppError(404, "ADJUSTMENT_NOT_FOUND");
    if (adj.status !== "PENDING") throw new AppError(400, "ADJUSTMENT_NOT_PENDING");
    return this.repo.updateAdjustmentStatus(adjId, "APPROVED", approverId);
  }

  async rejectAdjustment(headerId: number, adjId: number, approverId: number) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    const adj = header.adjustments.find(a => a.id === adjId);
    if (!adj) throw new AppError(404, "ADJUSTMENT_NOT_FOUND");
    if (adj.status !== "PENDING") throw new AppError(400, "ADJUSTMENT_NOT_PENDING");
    return this.repo.updateAdjustmentStatus(adjId, "REJECTED", approverId);
  }
}
