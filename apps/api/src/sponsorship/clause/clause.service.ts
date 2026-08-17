import { AppError } from "../../lib/appError";
import type { ClauseRepository } from "./clause.repo";
import type { CreateClauseDto } from "./dto/clause.dto";

export class ClauseService {
  constructor(private repo: ClauseRepository) {}

  list(sponsorshipId: number) {
    return this.repo.findAll(sponsorshipId);
  }

  create(sponsorshipId: number, dto: CreateClauseDto) {
    if (dto.rate === undefined && dto.fixedAmount === undefined) throw new AppError(400, "CLAUSE_AMOUNT_REQUIRED");
    return this.repo.create(sponsorshipId, dto);
  }

  async applyClause(id: number, sponsorshipId: number) {
    const clause = await this.repo.findById(id);
    if (!clause || clause.sponsorshipId !== sponsorshipId) throw new AppError(404, "CLAUSE_NOT_FOUND");
    if (clause.status !== "PENDING") throw new AppError(400, "CLAUSE_ALREADY_APPLIED");
    return this.repo.updateStatus(id, "APPLIED");
  }

  async waiveClause(id: number, sponsorshipId: number) {
    const clause = await this.repo.findById(id);
    if (!clause || clause.sponsorshipId !== sponsorshipId) throw new AppError(404, "CLAUSE_NOT_FOUND");
    if (clause.status !== "PENDING") throw new AppError(400, "CLAUSE_NOT_PENDING");
    return this.repo.updateStatus(id, "WAIVED");
  }
}
