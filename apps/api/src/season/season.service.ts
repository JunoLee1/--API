import { SeasonStatus } from "../generated/client";
import { AppError } from "../lib/appError";
import { SeasonRepository } from "./season.repo";
import { CreateSeasonDto, SetWageCapDto } from "./dto/season.dto";
import { getPrisma } from "../lib/prisma";
import { applyCarryOverToNextSeason } from "../lib/season-carryover";

export class SeasonService {
  constructor(private repo: SeasonRepository) {}

  async createSeason(data: CreateSeasonDto) {
    return await this.repo.create({
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      ...(data.leagueId !== undefined && { leagueId: data.leagueId }),
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

    const closed = await this.repo.updateStatus(id, SeasonStatus.CLOSED);
    // Best-effort auto-carryover: compute this season's approved net income
    // and write it into the next chronological season's FinancialReport. A
    // failure here (missing next season, DB blip) must not fail the close
    // itself — the value can still be entered manually via the override
    // endpoint. Manual overrides on the next season are never overwritten.
    try {
      await applyCarryOverToNextSeason(getPrisma(), id);
    } catch (err) {
      console.warn(`[closeSeason] carryover 자동 적용 실패 (seasonId=${id})`, err);
    }
    return closed;
  }

  async setWageCap(id: number, dto: SetWageCapDto) {
    const season = await this.repo.findById(id);
    if (!season) throw new AppError(404, "SEASON_NOT_FOUND");

    if (dto.wageCapType !== null && dto.wageCapValue == null) {
      throw new AppError(400, "WAGE_CAP_VALUE_REQUIRED");
    }
    if (dto.wageCapType === "RATIO" && dto.wageCapValue != null) {
      if (dto.wageCapValue <= 0 || dto.wageCapValue > 1) {
        throw new AppError(400, "RATIO_MUST_BE_0_TO_1");
      }
    }
    if (dto.wageCapType === "FIXED" && dto.wageCapValue != null && dto.wageCapValue <= 0) {
      throw new AppError(400, "INVALID_WAGE_CAP_VALUE");
    }

    return await this.repo.updateWageCap(id, dto.wageCapType, dto.wageCapValue);
  }

  async getWageCapKPI() {
    const kpi = await this.repo.findActiveWithKPI();
    if (!kpi) throw new AppError(404, "NO_ACTIVE_SEASON");
    return kpi;
  }
}
