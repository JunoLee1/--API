import { ProspectRepository } from "./prospect.repo";
import { AppError } from "../lib/appError";
import { CreateProspectDto, UpdateProspectDto, TransitionProspectStatusDto, SignProspectDto, ProspectMedicalResultDto, CreateProspectNegotiationLogDto } from "./dto/prospect.dto";
import { ProspectStatus, VideoEvalResult } from "../generated/enums";
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto } from "./dto/video-evaluation.dto";
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const notificationService = new NotificationService(new NotificationRepository(getPrisma()));

const NON_ACTIVE_STATUSES: ProspectStatus[] = ["LONGLIST", "SHORTLIST", "SIGNED", "ARCHIVED"];

export function computeVideoEvalResult(
  qualityPassed: boolean,
  identifiable: boolean,
  continuity: boolean,
  totalScore: number | null | undefined,
): VideoEvalResult {
  if (!qualityPassed || !identifiable || !continuity) return 'FAIL';
  if (totalScore != null && totalScore >= 70) return 'PASS';
  return 'PENDING';
}

export class ProspectService {
  constructor(private repo: ProspectRepository) {}

  checkDuplicate(name: string, currentTeam?: string) {
    return this.repo.checkDuplicate(name, currentTeam);
  }

  async create(dto: CreateProspectDto) {
    const { squadPlayers } = await this.repo.checkDuplicate(dto.name);
    if (squadPlayers.length > 0) throw new AppError(409, "ALREADY_IN_SQUAD");
    return this.repo.create(dto);
  }

  getAll(status?: ProspectStatus) {
    return this.repo.findAll(status);
  }

  async getById(id: number) {
    const prospect = await this.repo.findById(id);
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    return prospect;
  }

  async update(id: number, dto: UpdateProspectDto) {
    const prospect = await this.repo.findById(id);
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    return this.repo.update(id, dto);
  }

  async updateStatus(id: number, dto: TransitionProspectStatusDto) {
    if (dto.status === "SIGNED") throw new AppError(400, "USE_SIGN_ENDPOINT");
    if (dto.status === "SHORTLIST") {
      const latest = await this.repo.getLatestVideoEvaluation(id);
      if (!latest || latest.result !== "PASS") {
        throw new AppError(400, "VIDEO_EVAL_REQUIRED");
      }
    }
    return this.repo.updateStatus(id, dto.status);
  }

  async sign(id: number, dto: SignProspectDto) {
    const result = await this.repo.sign(id, dto);
    void notificationService.notifyProspectSigned(result.name).catch(console.error);
    return result;
  }

  async recordMedicalResult(id: number, dto: ProspectMedicalResultDto) {
    const prospect = await this.getById(id);
    if (prospect.status !== "MEDICAL_TEST") throw new AppError(409, "CANNOT_RECORD_MEDICAL_NON_PENDING");
    return this.repo.recordMedicalResult(id, dto);
  }

  async addNegotiationLog(id: number, dto: CreateProspectNegotiationLogDto, createdById: number) {
    const prospect = await this.getById(id);
    if (NON_ACTIVE_STATUSES.includes(prospect.status as ProspectStatus)) {
      throw new AppError(409, "CANNOT_LOG_NEGOTIATION_ON_NON_ACTIVE");
    }
    return this.repo.addNegotiationLog(id, dto, createdById);
  }

  getNegotiationLogs(id: number) {
    return this.repo.getNegotiationLogs(id);
  }

  async addVideoEvaluation(id: number, dto: CreateProspectVideoEvaluationDto, evaluatedById: number) {
    await this.getById(id); // 존재 확인
    const result = computeVideoEvalResult(dto.qualityPassed, dto.identifiable, dto.continuity, dto.totalScore);
    return this.repo.addVideoEvaluation(id, dto, evaluatedById, result);
  }

  getVideoEvaluations(id: number) {
    return this.repo.getVideoEvaluations(id);
  }

  async addEvaluationLog(id: number, dto: CreateProspectEvaluationLogDto, evaluatedById: number) {
    await this.getById(id); // 존재 확인
    return this.repo.addEvaluationLog(id, dto, evaluatedById);
  }

  getEvaluationLogs(id: number) {
    return this.repo.getEvaluationLogs(id);
  }

  checkAcquisitionGate(id: number) {
    return this.repo.checkAcquisitionGate(id);
  }
}
