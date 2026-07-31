import { ClubSettingsRepository } from "./club-settings.repo";

export class ClubSettingsService {
  constructor(private repo: ClubSettingsRepository) {}

  async get() {
    return this.repo.get();
  }

  async update(currency: string) {
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("INVALID_CURRENCY");
    }
    return this.repo.update(currency);
  }
}
