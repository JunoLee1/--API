import { InjuryRepository } from "./injury.repo";
import { AppError } from "../lib/appError";
import { CreateInjuryDto, UpdateInjuryStatusDto, UpsertInjuryReportDto } from "./dto/injury.dto";

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
}
