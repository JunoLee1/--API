import { ClubSettingsRepository } from "./club-settings.repo";
import { AppError } from "../lib/appError";

export class ClubSettingsService {
  constructor(private repo: ClubSettingsRepository) {}

  get() {
    return this.repo.get();
  }

  async update(data: { currency?: string; ibiBeta?: number }) {
    if (data.currency !== undefined && !/^[A-Z]{3}$/.test(data.currency)) {
      throw new AppError(400, "INVALID_CURRENCY");
    }
    if (data.ibiBeta !== undefined && (data.ibiBeta <= 0 || data.ibiBeta > 100)) {
      throw new AppError(400, "INVALID_IBI_BETA");
    }
    return this.repo.update(data);
  }
}
