import { InjuryRepository } from "./injury.repo";
import { AppError } from "../lib/appError";
import { CreateInjuryDto, UpdateInjuryStatusDto, UpsertInjuryReportDto, UpsertAssessmentDto } from "./dto/injury.dto";
import { calculateTotalScore, SCORE_THRESHOLD } from "./injury.score";
import { ExternalReportTarget } from "../generated/enums";

export class InjuryService {
  constructor(private repo: InjuryRepository) {}

  getByPlayer(playerId: string) {
    return this.repo.findByPlayer(playerId);
  }

  async getById(id: number) {
    const injury = await this.repo.findById(id);
    if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");
    return injury;
  }

  createInjury(dto: CreateInjuryDto) {
    return this.repo.create(dto);
  }

  async updateStatus(id: number, dto: UpdateInjuryStatusDto) {
    const injury = await this.repo.findById(id);
    if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");
    return this.repo.updateStatus(id, dto);
  }

  async getReport(injuryId: number) {
    const injury = await this.repo.findById(injuryId);
    if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");
    return this.repo.findReport(injuryId);
  }

  async saveReport(injuryId: number, dto: UpsertInjuryReportDto, userId: number) {
    const injury = await this.repo.findById(injuryId);
    if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");
    return this.repo.upsertReport(injuryId, dto, userId);
  }

  async signReport(injuryId: number, role: 'COACH' | 'TRAINER' | 'MEDICAL', userId: number) {
    const report = await this.repo.findReport(injuryId);
    if (!report) throw new AppError(404, "INJURY_REPORT_NOT_FOUND");
    return this.repo.signReport(injuryId, role, userId);
  }

  async unsignReport(injuryId: number, role: 'COACH' | 'TRAINER' | 'MEDICAL') {
    const report = await this.repo.findReport(injuryId);
    if (!report) throw new AppError(404, "INJURY_REPORT_NOT_FOUND");
    return this.repo.unsignReport(injuryId, role);
  }

  getStats() {
    return this.repo.getStats();
  }

  getAssessment(injuryId: number) {
    return this.repo.getAssessment(injuryId);
  }

  async processAssessment(injuryId: number, dto: UpsertAssessmentDto, assessedById: number) {
    const scores = calculateTotalScore(dto);

    const assessment = await this.repo.upsertAssessment(injuryId, { ...dto, ...scores }, assessedById);

    if (scores.totalScore >= SCORE_THRESHOLD) {
      const injury = await this.repo.findById(injuryId);
      if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");

      const isYouth = injury.player.level === "YOUTH";
      const targets: ExternalReportTarget[] = isYouth
        ? [ExternalReportTarget.EDUCATION_OFFICE, ExternalReportTarget.SCHOOL_SAFETY]
        : [ExternalReportTarget.LEAGUE, ExternalReportTarget.FEDERATION, ExternalReportTarget.INSURANCE];

      const reportData = {
        playerName: injury.player.playerName,
        bodyPart: injury.bodyPart,
        cause: injury.cause,
        occurredAt: injury.occurredAt,
        totalScore: scores.totalScore,
        generatedAt: new Date().toISOString(),
      };

      await this.repo.createExternalReports(injuryId, targets, reportData);
    }

    return { assessment, triggeredReports: scores.totalScore >= SCORE_THRESHOLD };
  }

  getExternalReports(injuryId: number) {
    return this.repo.getExternalReports(injuryId);
  }
}
