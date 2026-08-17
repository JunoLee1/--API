import { ClubSettingsRepository } from "./club-settings.repo";
import { AppError } from "../lib/appError";

export class ClubSettingsService {
  constructor(private repo: ClubSettingsRepository) {}

  get() {
    return this.repo.get();
  }

  async update(data: { currency?: string; ibiBeta?: number; maintenanceCostLimit?: number }) {
    if (data.currency !== undefined && !/^[A-Z]{3}$/.test(data.currency)) {
      throw new AppError(400, "INVALID_CURRENCY");
    }
    if (data.ibiBeta !== undefined && (data.ibiBeta <= 0 || data.ibiBeta > 100)) {
      throw new AppError(400, "INVALID_IBI_BETA");
    }
    if (data.maintenanceCostLimit !== undefined && (!Number.isInteger(data.maintenanceCostLimit) || data.maintenanceCostLimit <= 0)) {
      throw new AppError(400, "INVALID_MAINTENANCE_COST_LIMIT");
    }
    return this.repo.update(data);
  }
}
