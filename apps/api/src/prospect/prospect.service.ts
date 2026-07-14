import { ProspectRepository } from "./prospect.repo";
import { AppError } from "../lib/appError";
import { CreateProspectDto, UpdateProspectDto, TransitionProspectStatusDto, SignProspectDto } from "./dto/prospect.dto";
import { ProspectStatus } from "../generated/enums";

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

  sign(id: number, dto: SignProspectDto) {
    return this.repo.sign(id, dto);
  }
}
