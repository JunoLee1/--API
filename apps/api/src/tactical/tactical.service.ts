import { TacticalRepository } from "./tactical.repo";
import { AppError } from "../lib/appError";
import { CreateAnalysisDto, AddLineupDto, AddMediaDto } from "./dto/tactical.dto";

export class TacticalService {
  constructor(private repo: TacticalRepository) {}

  getByMatch(matchId: number) {
    return this.repo.findByMatch(matchId);
  }

  async getById(id: number) {
    const analysis = await this.repo.findById(id);
    if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
    return analysis;
  }

  createAnalysis(dto: CreateAnalysisDto, createdById: number) {
    return this.repo.create(dto, createdById);
  }

  async addLineup(analysisId: number, dto: AddLineupDto) {
    const analysis = await this.repo.findById(analysisId);
    if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
    return this.repo.addLineup(analysisId, dto);
  }

  async addMedia(analysisId: number, dto: AddMediaDto) {
    const analysis = await this.repo.findById(analysisId);
    if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
    return this.repo.addMedia(analysisId, dto);
  }

  async confirmAnalysis(id: number) {
    const analysis = await this.repo.findById(id);
    if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
    if (analysis.status === "CONFIRMED") throw new AppError(409, "ALREADY_CONFIRMED");
    return this.repo.confirm(id);
  }
}
