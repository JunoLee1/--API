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

  create(dto: CreateTeamDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateTeamDto) {
    await this.getById(id);
    return this.repo.update(id, dto);
  }

  async deactivate(id: number) {
    await this.getById(id);
    return this.repo.update(id, { isActive: false });
  }

  async setLiteMode(teamId: number, isLite: boolean, requesterRole: string) {
    if (requesterRole !== 'ADMIN') throw new AppError(403, 'FORBIDDEN');
    const team = await this.repo.findById(teamId);
    if (!team) throw new AppError(404, 'TEAM_NOT_FOUND');
    return this.repo.updateLiteFlag(teamId, isLite);
  }
}
