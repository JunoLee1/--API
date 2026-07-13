import { ProspectRepository } from "./prospect.repo";
import { AppError } from "../lib/appError";
import { CreateProspectDto, UpdateProspectDto, UpdateProspectStatusDto } from "./dto/prospect.dto";
import { ProspectStatus } from "../generated/enums";

const ALLOWED_TRANSITIONS: Partial<Record<ProspectStatus, ProspectStatus[]>> = {
  ACTIVE: ["SIGNED", "ARCHIVED"],
};

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

  async updateStatus(id: number, dto: UpdateProspectStatusDto) {
    const prospect = await this.repo.findById(id);
    if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
    const allowed = ALLOWED_TRANSITIONS[prospect.status] ?? [];
    if (!allowed.includes(dto.status)) throw new AppError(409, "INVALID_STATUS_TRANSITION");
    if (dto.status === "SIGNED" && !dto.convertedPlayerId) {
      throw new AppError(400, "SIGNED_REQUIRES_CONVERTED_PLAYER_ID");
    }
    return this.repo.updateStatus(id, dto.status, dto.convertedPlayerId);
  }
}
