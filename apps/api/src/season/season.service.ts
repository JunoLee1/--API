import { SeasonStatus } from "../generated/client";
import { AppError } from "../lib/appError";
import { SeasonRepository } from "./season.repo";
import { CreateSeasonDto } from "./dto/season.dto";

export class SeasonService {
  constructor(private repo: SeasonRepository) {}

  async createSeason(data: CreateSeasonDto) {
    return await this.repo.create({
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });
  }

  async getSeasons(status?: string) {
    const parsed = status as SeasonStatus | undefined;
    return await this.repo.findAll(parsed);
  }

  async getActiveSeason() {
    const season = await this.repo.findActive();
    if (!season) throw new AppError(404, "NO_ACTIVE_SEASON");
    return season;
  }

  async getSeasonById(id: number) {
    const season = await this.repo.findById(id);
    if (!season) throw new AppError(404, "SEASON_NOT_FOUND");
    return season;
  }

  async activateSeason(id: number) {
    const season = await this.repo.findById(id);
    if (!season) throw new AppError(404, "SEASON_NOT_FOUND");
    if (season.status !== SeasonStatus.UPCOMING) {
      throw new AppError(400, "SEASON_NOT_UPCOMING");
    }

    const active = await this.repo.findActive();
    if (active) throw new AppError(409, "ACTIVE_SEASON_EXISTS");

    return await this.repo.updateStatus(id, SeasonStatus.ACTIVE);
  }

  async closeSeason(id: number) {
    const season = await this.repo.findById(id);
    if (!season) throw new AppError(404, "SEASON_NOT_FOUND");
    if (season.status !== SeasonStatus.ACTIVE) {
      throw new AppError(400, "SEASON_NOT_ACTIVE");
    }

    return await this.repo.updateStatus(id, SeasonStatus.CLOSED);
  }
}
