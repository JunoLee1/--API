import { ProspectRepository } from "./prospect.repo";
import { AppError } from "../lib/appError";
import { CreateProspectDto, UpdateProspectDto, TransitionProspectStatusDto, SignProspectDto, ProspectMedicalResultDto, CreateProspectNegotiationLogDto } from "./dto/prospect.dto";
import { ProspectStatus } from "../generated/enums";
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const notificationService = new NotificationService(new NotificationRepository(getPrisma()));

const NON_ACTIVE_STATUSES: ProspectStatus[] = ["LONGLIST", "SHORTLIST", "SIGNED", "ARCHIVED"];

export class ProspectService {
  constructor(private repo: ProspectRepository) {}

  getAll(status?: ProspectStatus) {
    return this.repo.findAll(status);
  }

  async getById(id: number) {
    const prospect = await this.repo.findById(id);
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    return prospect;
  }

  create(dto: CreateProspectDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateProspectDto) {
    const prospect = await this.repo.findById(id);
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    return this.repo.update(id, dto);
  }

  updateStatus(id: number, dto: TransitionProspectStatusDto) {
    if (dto.status === "SIGNED") throw new AppError(400, "USE_SIGN_ENDPOINT");
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
}
