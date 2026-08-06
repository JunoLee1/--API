import { TeamRepository, CreateTeamDto, UpdateTeamDto } from "./team.repo";
import { AppError } from "../lib/appError";

export class TeamService {
  constructor(private repo: TeamRepository) {}

  getAll() {
    return this.repo.findAll();
  }

  async getById(id: number) {
    const team = await this.repo.findById(id);
    if (!team) throw new AppError(404, "TEAM_NOT_FOUND");
    return team;
  }

  async create(dto: CreateTeamDto) {
    if (dto.type === "YOUTH" && dto.clubId) {
      const existing = await this.repo.findActiveByNameAndClub(dto.name, dto.clubId);
      if (existing) throw new AppError(409, "TEAM_ALREADY_EXISTS");
    }
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateTeamDto) {
    const team = await this.getById(id);
    if (team.type === "YOUTH" && dto.name && team.clubId) {
      const existing = await this.repo.findActiveByNameAndClub(dto.name, team.clubId, id);
      if (existing) throw new AppError(409, "TEAM_ALREADY_EXISTS");
    }
    return this.repo.update(id, dto);
  }

  async deactivate(id: number) {
    await this.getById(id);
    return this.repo.update(id, { isActive: false });
  }
}
