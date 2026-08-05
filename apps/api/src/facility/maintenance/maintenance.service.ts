import { AppError } from "../../lib/appError";
import { NotificationService } from "../../notification/notification.service";
import type { MaintenanceRepository } from "./maintenance.repo";
import type { CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceListQuery } from "./dto/maintenance.dto";

const TERMINAL_STATUSES = ["RESOLVED", "REJECTED"] as const;

export class MaintenanceService {
  constructor(
    private repo: MaintenanceRepository,
    private notifications: NotificationService,
  ) {}

  list(query: MaintenanceListQuery) {
    return this.repo.findAll(query);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "MAINTENANCE_REQUEST_NOT_FOUND");
    return record;
  }

  async create(dto: CreateMaintenanceDto, createdById: number) {
    const record = await this.repo.create({ ...dto, createdById });
    if (record.priority === "EMERGENCY") {
      void this.notifications.notifyFacilityEmergency(record.title, record.id).catch(console.error);
    }
    return record;
  }

  async update(id: number, dto: UpdateMaintenanceDto) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(404, "MAINTENANCE_NOT_FOUND");
    if (existing.isLocked) throw new AppError(400, "MAINTENANCE_LOCKED");
    if ((TERMINAL_STATUSES as readonly string[]).includes(existing.status)) {
      throw new AppError(409, "ALREADY_RESOLVED");
    }
    return this.repo.update(id, dto);
  }

  async updateStatus(id: number, status: string) {
    const existing = await this.get(id);
    if ((TERMINAL_STATUSES as readonly string[]).includes(existing.status)) {
      throw new AppError(409, "ALREADY_RESOLVED");
    }
    const ALLOWED = ["IN_PROGRESS", "PENDING_APPROVAL"];
    if (!ALLOWED.includes(status)) throw new AppError(400, "INVALID_STATUS_TRANSITION");
    return this.repo.updateStatus(id, status);
  }

  async approve(id: number, approverId: number) {
    const existing = await this.get(id);
    if (existing.status !== "PENDING_APPROVAL") throw new AppError(400, "INVALID_STATUS_TRANSITION");
    return this.repo.approve(id, approverId);
  }

  async gmApprove(id: number, gmId: number) {
    const existing = await this.get(id);
    if (existing.status !== "APPROVED") throw new AppError(400, "INVALID_STATUS_TRANSITION");
    const record = await this.repo.gmApprove(id, gmId);
    void this.notifications.notifyFacilityResolved(existing.title, id).catch(console.error);
    return record;
  }

  async reject(id: number, reason?: string) {
    const existing = await this.get(id);
    const REJECTABLE = ["PENDING_APPROVAL", "APPROVED"];
    if (!REJECTABLE.includes(existing.status)) throw new AppError(400, "INVALID_STATUS_TRANSITION");
    return this.repo.reject(id, reason);
  }

  async lock(id: number) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(404, "MAINTENANCE_NOT_FOUND");
    if (existing.status !== "RESOLVED") throw new AppError(400, "CANNOT_LOCK_UNRESOLVED");
    if (existing.isLocked) throw new AppError(400, "MAINTENANCE_ALREADY_LOCKED");
    return this.repo.lock(id);
  }

  async submitToFinance(id: number, userId: number) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(404, "MAINTENANCE_NOT_FOUND");
    const cost = existing.estimatedCost ? Number(existing.estimatedCost) : 0;
    if (cost < 1000000) throw new AppError(400, "COST_BELOW_THRESHOLD");
    if (existing.financeSubmittedAt) throw new AppError(400, "ALREADY_SUBMITTED_TO_FINANCE");

    const result = await this.repo.submitToFinance(id);

    void this.notifications.notifyFacilityFinanceSubmit(existing.title, id, cost).catch(console.error);

    return result;
  }
}
