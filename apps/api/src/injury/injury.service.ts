import { InjuryRepository } from "./injury.repo";
import { AppError } from "../lib/appError";
import { CreateInjuryDto, UpdateInjuryStatusDto } from "./dto/injury.dto";

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

  getStats() {
    return this.repo.getStats();
  }
}
