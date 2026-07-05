import { TrainingRepository } from "./training.repo";
import { AppError } from "../lib/appError";
import { CreateSessionDto, AddContentDto, AddParticipantsDto, UpsertResultDto, SessionListQuery } from "./dto/training.dto";

export class TrainingService {
  constructor(private repo: TrainingRepository) {}

  getSessions(query: SessionListQuery) {
    return this.repo.findAll(query);
  }

  async getSessionById(id: number) {
    const session = await this.repo.findById(id);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    return session;
  }

  createSession(dto: CreateSessionDto, createdById: number) {
    return this.repo.create(dto, createdById);
  }

  async approveSession(id: number, approvedById: number) {
    const session = await this.repo.findById(id);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    if (session.isApproved) throw new AppError(409, "ALREADY_APPROVED");
    return this.repo.approve(id, approvedById);
  }

  async addContent(sessionId: number, dto: AddContentDto) {
    const session = await this.repo.findById(sessionId);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    return this.repo.addContent(sessionId, dto);
  }

  async addParticipants(sessionId: number, dto: AddParticipantsDto) {
    const session = await this.repo.findById(sessionId);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    return this.repo.addParticipants(sessionId, dto);
  }

  async upsertResult(sessionId: number, dto: UpsertResultDto) {
    const session = await this.repo.findById(sessionId);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    const existing = await this.repo.findResult(sessionId, dto.playerId);
    if (existing) return this.repo.updateResult(existing.id, dto);
    return this.repo.createResult(sessionId, dto);
  }
}
