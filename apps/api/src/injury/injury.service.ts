import { InjuryRepository } from "./injury.repo";
import { AppError } from "../lib/appError";
import { CreateInjuryDto, UpdateInjuryStatusDto, UpsertInjuryReportDto, UpsertAssessmentDto } from "./dto/injury.dto";
import { calculateTotalScore, SCORE_THRESHOLD } from "./injury.score";
import { ExternalReportTarget, ExternalReportStatus } from "../generated/enums";
import { NotificationRepository } from "../notification/notification.repo";

const DUE_DAYS: Record<ExternalReportTarget, number> = {
  EDUCATION_OFFICE: 3,
  SCHOOL_SAFETY: 3,
  INSURANCE: 5,
  LEAGUE: 7,
  FEDERATION: 7,
};

export class InjuryService {
  constructor(
    private repo: InjuryRepository,
    private notifRepo: NotificationRepository,
  ) {}

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

      const now = new Date();
      const targetsWithDue = targets.map((target) => {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + DUE_DAYS[target]);
        return { target, dueDate };
      });
      await this.repo.createExternalReports(injuryId, targetsWithDue, reportData);

      try {
        await this.notifRepo.createForMedicalDirector(
          "EXTERNAL_REPORT_CREATED",
          "외부 의무보고서 생성됨",
          `부상 #${injuryId}에 대해 외부 의무보고서 ${targets.length}건이 생성됐습니다. 제출 기한을 확인하세요.`,
          injuryId,
        );
      } catch {
        // 알림 실패는 치명적이지 않음
      }
    }

    return { assessment, triggeredReports: scores.totalScore >= SCORE_THRESHOLD };
  }

  getExternalReports(injuryId: number) {
    return this.repo.getExternalReports(injuryId);
  }

  async updateExternalReportStatus(reportId: number, status: ExternalReportStatus, note?: string) {
    const report = await this.repo.findExternalReportById(reportId);
    if (!report) throw new AppError(404, "EXTERNAL_REPORT_NOT_FOUND");
    return this.repo.updateExternalReportStatus(reportId, status, note);
  }
}
