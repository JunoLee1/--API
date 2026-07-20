import { AppError } from "../lib/appError";
import { JerseyRepository } from "./jersey.repo";
import { AssignJerseyDto } from "./dto/jersey.dto";

export class JerseyService {
  constructor(private repo: JerseyRepository) {}

  listByTeam(teamId: number) {
    return this.repo.findByTeam(teamId);
  }

  listByPlayer(playerId: string) {
    return this.repo.findByPlayer(playerId);
  }

  async assignToPlayer(teamId: number, dto: AssignJerseyDto) {
    const existing = await this.repo.findByNumberAndTeam(dto.number, teamId);

    if (existing) {
      if (existing.status === "OCCUPIED") throw new AppError(409, "JERSEY_NUMBER_OCCUPIED");
      if (existing.status === "RETIRED") throw new AppError(403, "JERSEY_NUMBER_RETIRED");
      if (existing.status === "RESERVED") throw new AppError(409, "JERSEY_NUMBER_RESERVED");
      return this.repo.updateStatus(existing.id, { status: "OCCUPIED", playerId: dto.playerId });
    }

    return this.repo.create(teamId, { ...dto, status: "OCCUPIED" });
  }

  async release(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey) throw new AppError(404, "JERSEY_NOT_FOUND");
    if (jersey.status !== "OCCUPIED") throw new AppError(409, "JERSEY_NOT_OCCUPIED");
    return this.repo.updateStatus(jersey.id, { status: "AVAILABLE", playerId: null });
  }

  async retire(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey) {
      return this.repo.create(teamId, { number, status: "RETIRED" });
    }
    if (jersey.status !== "AVAILABLE") throw new AppError(409, "JERSEY_MUST_BE_AVAILABLE_TO_RETIRE");
    return this.repo.updateStatus(jersey.id, { status: "RETIRED", playerId: null });
  }

  async reactivate(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey || jersey.status !== "RETIRED") throw new AppError(409, "JERSEY_NOT_RETIRED");
    return this.repo.updateStatus(jersey.id, { status: "AVAILABLE" });
  }
}
