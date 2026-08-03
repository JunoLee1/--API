import { AppError } from "../../lib/appError";
import { NotificationService } from "../../notification/notification.service";
import type { MaintenanceRepository } from "./maintenance.repo";
import type { CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceListQuery } from "./dto/maintenance.dto";

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
    const existing = await this.get(id);
    if (existing.status === "RESOLVED") throw new AppError(409, "ALREADY_RESOLVED");

    const resolvedAt = dto.status === "RESOLVED" ? new Date() : undefined;
    const record = await this.repo.update(id, { ...dto, ...(resolvedAt && { resolvedAt }) });

    if (dto.status === "RESOLVED") {
      void this.notifications.notifyFacilityResolved(existing.title, id).catch(console.error);
    }
    return record;
  }
}
